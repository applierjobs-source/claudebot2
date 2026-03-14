"""
Claude agent execution loop: observe -> think -> act -> log -> repeat.
Includes retry, timeout, budget tracking, and state persistence.
"""
import os
import time
import json
from datetime import datetime, timedelta
from anthropic import Anthropic
from config import load_config
from tools import get_tools_for_agent, execute_tool, ToolResult
from logger import log

WORKSPACE = "/workspace"
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")


def run_loop():
    config = load_config()
    system_prompt = config.get("systemPrompt", "")
    allowed_tools = config.get("allowedTools", [])
    max_runtime_minutes = config.get("maxRuntimeMinutes", 60)
    max_tokens_per_run = config.get("maxTokensPerRun", 100_000)
    max_spend_cents = config.get("maxSpendCents", 500)
    startup_actions = config.get("startupActions")

    os.makedirs(WORKSPACE, exist_ok=True)
    context = {
        "workspace": WORKSPACE,
        "api_url": os.environ.get("API_URL", ""),
        "log_token": os.environ.get("LOG_TOKEN", ""),
    }

    tools = get_tools_for_agent(allowed_tools)
    tool_defs_for_api = [
        {"name": t["name"], "description": t["description"], "input_schema": t["input_schema"]}
        for t in tools
    ]

    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    model = "claude-sonnet-4-6"
    if not ANTHROPIC_API_KEY:
        log("error", "ANTHROPIC_API_KEY not set; agent cannot run")
        return

    start_wall = time.time()
    end_wall = start_wall + max_runtime_minutes * 60
    tokens_used = 0
    spend_cents_approx = 0
    # Rough estimate: $3/M input, $15/M output -> cents per 1k tokens
    CENTS_PER_1K_IN = 0.03
    CENTS_PER_1K_OUT = 0.15

    messages = []
    if startup_actions:
        messages.append({
            "role": "user",
            "content": f"Startup actions: {json.dumps(startup_actions)}. Begin your task. Use get_memory first if you need prior state.",
        })
    else:
        messages.append({
            "role": "user",
            "content": "Begin your task. Use get_memory first to load any prior state, then proceed with your goals.",
        })

    log("info", "Agent loop started", {"max_runtime_min": max_runtime_minutes, "allowed_tools": allowed_tools})
    run_complete = False

    while True:
        if time.time() > end_wall:
            log("info", "Max runtime reached; stopping")
            break
        if tokens_used >= max_tokens_per_run:
            log("info", "Token budget exhausted; stopping")
            break
        if spend_cents_approx >= max_spend_cents:
            log("info", "Spend limit reached; stopping")
            break
        if context.get("_complete_requested"):
            log("info", "Task complete", {"summary": context.get("_complete_summary", "")})
            run_complete = True
            break

        # Think: call Claude
        try:
            response = client.messages.create(
                model=model,
                max_tokens=4096,
                system=system_prompt,
                messages=messages,
                tools=tool_defs_for_api,
            )
        except Exception as e:
            log("error", f"Claude API error: {e}")
            time.sleep(5)
            continue

        # Count tokens and spend
        if hasattr(response, "usage"):
            tokens_used += (response.usage.input_tokens or 0) + (response.usage.output_tokens or 0)
            spend_cents_approx += (response.usage.input_tokens or 0) / 1000 * CENTS_PER_1K_IN
            spend_cents_approx += (response.usage.output_tokens or 0) / 1000 * CENTS_PER_1K_OUT

        # Append assistant turn
        assistant_content = []
        for block in response.content:
            if block.type == "text":
                assistant_content.append({"type": "text", "text": block.text})
                log("info", block.text[:500] + ("..." if len(block.text) > 500 else ""))
            elif block.type == "tool_use":
                assistant_content.append({
                    "type": "tool_use",
                    "id": block.id,
                    "name": block.name,
                    "input": block.input,
                })
        messages.append({"role": "assistant", "content": assistant_content})

        # Stop if no tool use (final text response)
        tool_uses = [b for b in response.content if getattr(b, "type", None) == "tool_use"]
        if not tool_uses:
            break

        # Act: execute each tool and append results
        tool_results = []
        for block in response.content:
            if getattr(block, "type", None) != "tool_use":
                continue
            name = block.name
            args = block.input if isinstance(block.input, dict) else {}
            log("action", f"Tool: {name}", {"name": name, "args": args})
            result = execute_tool(name, args, context)
            log("info", result.output[:1000] if result.output else "(no output)", {"success": result.success})
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": result.output[:15000],
                "is_error": not result.success,
            })

        messages.append({"role": "user", "content": tool_results})

        time.sleep(0.3)

    log("info", f"Loop ended. tokens_used≈{tokens_used} spend_cents≈{spend_cents_approx:.2f} complete={run_complete}")


if __name__ == "__main__":
    run_loop()

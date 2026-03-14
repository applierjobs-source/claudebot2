"""Load config from env (CONFIG_B64 or CONFIG_JSON)."""
import os
import json
import base64

def load_config():
    raw = os.environ.get("CONFIG_B64") or os.environ.get("CONFIG_JSON")
    if not raw:
        return _default_config()
    if os.environ.get("CONFIG_B64"):
        raw = base64.b64decode(raw).decode("utf-8")
    return json.loads(raw)

def _default_config():
    return {
        "systemPrompt": "You are an autonomous agent. Use available tools to accomplish your goals. Log your progress.",
        "allowedTools": ["browse_page", "extract_content", "http_request", "read_file", "write_file", "list_dir", "store_memory", "get_memory", "complete"],
        "maxRuntimeMinutes": 60,
        "maxTokensPerRun": 100_000,
        "maxSpendCents": 500,
        "startupActions": None,
        "scheduleCron": None,
    }

# Claude Agent Runtime Design

## Execution Loop

```
  ┌─────────────────────────────────────────────────────────────────┐
  │  loop (until stopped or limit):                                  │
  │    1. OBSERVE: load state from bot_memory; fetch pending tasks   │
  │    2. THINK: call Claude with system prompt + tools + state      │
  │    3. ACT: execute tool calls returned by Claude                 │
  │    4. LOG: send logs to backend; persist state                   │
  │    5. CHECK: runtime limits, token budget, spend; exit if over   │
  │    6. SLEEP (optional): if schedule_cron or interval            │
  └─────────────────────────────────────────────────────────────────┘
```

## Tool Registry

- Each template defines `allowed_tools`. Runtime only exposes those tools to Claude.
- Tool schema follows Anthropic tool-use format: name, description, input_schema (JSON Schema).

## Core Tools (MVP)

| Tool | Description | Template usage |
|------|-------------|----------------|
| browse_page | Open URL, return snapshot or text | All browser-based templates |
| extract_content | Extract links, text, or structured data from last page | Faucet, airdrop, domain |
| http_request | GET/POST request to arbitrary URL | All |
| read_file | Read from workspace path | Rebuild, discovery |
| write_file | Write to workspace path | Rebuild, store results |
| list_dir | List workspace directory | Rebuild, discovery |
| store_memory | Persist key-value to bot_memory | All |
| get_memory | Read key-value from bot_memory | All |
| schedule_action | Queue a follow-up task (e.g. “in 5 min, check X”) | All |
| complete | Mark task done and optionally set result | All |

## State and Persistence

- **In-container**: Workspace directory for files; small SQLite or JSON file for “current run” state if needed.
- **Backend**: `bot_memory` table for key-value state that survives restarts; bot sends `store_memory` via API; runtime loads on start.

## Logging

- Every tool call and result summary is logged.
- Logs are sent to backend POST `/api/bots/:id/logs` (batch or stream).
- Levels: info, warn, error, action (for tool invocations).

## Retry and Timeout

- Claude API calls: retry with backoff (e.g. 3 retries); timeout per request (e.g. 120s).
- Tool execution: timeout per tool (e.g. 60s for browse, 10s for http).
- Run limits: max_runtime_minutes, max_tokens_per_run, max_spend_cents enforced in loop.

## Budget Tracking

- After each Claude response, accumulate tokens and estimated cost; compare to template limits; stop run if over.

## Error Handling

- Tool errors: return error message to Claude so it can adapt.
- API errors: retry then log and optionally pause or exit.
- Unhandled exception: log, persist state, exit with status so backend can mark bot as error and optionally restart.

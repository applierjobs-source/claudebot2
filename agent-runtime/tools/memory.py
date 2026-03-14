"""Bot memory: get_memory loads from API, store_memory writes to API."""
import os
import json
import urllib.request
from .registry import ToolResult

def _api(context: dict, path: str, method: str = "GET", body: dict = None) -> dict:
    base = (context.get("api_url") or os.environ.get("API_URL", "")).rstrip("/")
    token = context.get("log_token") or os.environ.get("LOG_TOKEN", "")
    url = f"{base}/api/memory{path}"
    req = urllib.request.Request(url, method=method)
    req.add_header("X-Log-Token", token)
    req.add_header("Content-Type", "application/json")
    if body is not None:
        req.data = json.dumps(body).encode("utf-8")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        return {"_error": str(e)}


def get_memory(args: dict, context: dict) -> ToolResult:
    data = _api(context, "")
    if "_error" in data:
        return ToolResult(False, data["_error"])
    return ToolResult(True, json.dumps(data, indent=2))


def store_memory(args: dict, context: dict) -> ToolResult:
    key = args.get("key")
    value = args.get("value", "")
    if not key:
        return ToolResult(False, "Missing key")
    data = _api(context, "", "POST", {key: value})
    if "_error" in data:
        return ToolResult(False, data["_error"])
    return ToolResult(True, f"Stored key: {key}")

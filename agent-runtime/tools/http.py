"""HTTP request tool."""
import httpx
from .registry import ToolResult


def http_request(args: dict, context: dict) -> ToolResult:
    url = args.get("url")
    if not url:
        return ToolResult(False, "Missing url")
    method = (args.get("method") or "GET").upper()
    headers = args.get("headers") or {}
    body = args.get("body")
    try:
        with httpx.Client(timeout=20.0) as client:
            r = client.request(method, url, headers=headers, content=body)
        text = r.text
        if len(text) > 12000:
            text = text[:12000] + "\n... (truncated)"
        return ToolResult(True, f"Status: {r.status_code}\n\n{text}")
    except Exception as e:
        return ToolResult(False, str(e))

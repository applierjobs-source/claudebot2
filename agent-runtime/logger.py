"""Send logs to backend API."""
import os
import json
import urllib.request
from typing import Any

def log(level: str, message: str, meta: dict = None):
    api_url = os.environ.get("API_URL", "").rstrip("/")
    log_token = os.environ.get("LOG_TOKEN", "")
    if not api_url or not log_token:
        print(f"[{level}] {message}", flush=True)
        return
    url = f"{api_url}/api/logs/ingest"
    payload = {"level": level, "message": message, "meta": meta or {}}
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("X-Log-Token", log_token)
    req.add_header("Content-Type", "application/json")
    try:
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        print(f"[logger] Log ingest failed. From the Droplet, API_URL must be the public API URL (e.g. https://your-api.railway.app). Error: {e}", flush=True)

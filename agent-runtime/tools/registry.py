"""Tool registry: build Claude tool definitions and executor from allowed_tools list."""
from .browser import browse_page, extract_content
from .http import http_request
from .files import read_file, write_file, list_dir
from .memory import store_memory, get_memory
from .complete import complete

TOOL_DEFS = {
    "browse_page": {
        "name": "browse_page",
        "description": "Open a URL in a headless browser and return the page content as text. Use this to visit websites and read their content.",
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "Full URL to open (e.g. https://example.com)"},
            },
            "required": ["url"],
        },
    },
    "extract_content": {
        "name": "extract_content",
        "description": "Extract structured content from the last browsed page: links, headings, or main text. Call browse_page first.",
        "input_schema": {
            "type": "object",
            "properties": {
                "what": {"type": "string", "enum": ["links", "headings", "text", "all"], "description": "What to extract"},
            },
            "required": ["what"],
        },
    },
    "http_request": {
        "name": "http_request",
        "description": "Make an HTTP GET or POST request to a URL. Returns status and body.",
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {"type": "string"},
                "method": {"type": "string", "enum": ["GET", "POST"], "default": "GET"},
                "headers": {"type": "object", "additionalProperties": {"type": "string"}},
                "body": {"type": "string"},
            },
            "required": ["url"],
        },
    },
    "read_file": {
        "name": "read_file",
        "description": "Read contents of a file from the workspace (path relative to workspace root).",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Relative path, e.g. data/results.json"},
            },
            "required": ["path"],
        },
    },
    "write_file": {
        "name": "write_file",
        "description": "Write content to a file in the workspace. Creates directories if needed.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "content": {"type": "string"},
            },
            "required": ["path", "content"],
        },
    },
    "list_dir": {
        "name": "list_dir",
        "description": "List files and directories in a workspace path.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "default": "."},
            },
        },
    },
    "store_memory": {
        "name": "store_memory",
        "description": "Persist a key-value in bot memory (survives restarts). Use for state you need later.",
        "input_schema": {
            "type": "object",
            "properties": {
                "key": {"type": "string"},
                "value": {"type": "string"},
            },
            "required": ["key", "value"],
        },
    },
    "get_memory": {
        "name": "get_memory",
        "description": "Retrieve all bot memory as key-value. Call once at start to load state.",
        "input_schema": {"type": "object", "properties": {}},
    },
    "complete": {
        "name": "complete",
        "description": "Mark the current task complete and optionally set a result summary. Call when done or pausing.",
        "input_schema": {
            "type": "object",
            "properties": {
                "summary": {"type": "string"},
            },
        },
    },
}

EXECUTORS = {
    "browse_page": browse_page,
    "extract_content": extract_content,
    "http_request": http_request,
    "read_file": read_file,
    "write_file": write_file,
    "list_dir": list_dir,
    "store_memory": store_memory,
    "get_memory": get_memory,
    "complete": complete,
}


class ToolResult:
    def __init__(self, success: bool, output: str, data=None):
        self.success = success
        self.output = output
        self.data = data or {}


def get_tools_for_agent(allowed_tools: list[str]):
    """Return list of tool definitions for Claude API (name, description, input_schema)."""
    return [TOOL_DEFS[t] for t in allowed_tools if t in TOOL_DEFS]


def execute_tool(name: str, args: dict, context: dict) -> ToolResult:
    """Execute a tool by name with args; context has workspace, api_url, log_token, memory cache, etc."""
    if name not in EXECUTORS:
        return ToolResult(False, f"Unknown tool: {name}")
    try:
        return EXECUTORS[name](args, context)
    except Exception as e:
        return ToolResult(False, str(e))

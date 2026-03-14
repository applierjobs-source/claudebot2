"""Complete tool: signals task done; runtime can use this to pause or record summary."""
from .registry import ToolResult


def complete(args: dict, context: dict) -> ToolResult:
    summary = args.get("summary", "")
    context["_complete_requested"] = True
    context["_complete_summary"] = summary
    return ToolResult(True, "Task marked complete." + (f" Summary: {summary}" if summary else ""))

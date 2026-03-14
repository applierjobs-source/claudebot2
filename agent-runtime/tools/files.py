"""File tools: read_file, write_file, list_dir. Paths relative to workspace."""
import os
from .registry import ToolResult


def _workspace(context: dict) -> str:
    return context.get("workspace") or "/workspace"


def read_file(args: dict, context: dict) -> ToolResult:
    path = args.get("path")
    if not path:
        return ToolResult(False, "Missing path")
    root = _workspace(context)
    full = os.path.normpath(os.path.join(root, path))
    if not full.startswith(root):
        return ToolResult(False, "Path escapes workspace")
    try:
        with open(full, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        return ToolResult(True, content)
    except FileNotFoundError:
        return ToolResult(False, "File not found")
    except Exception as e:
        return ToolResult(False, str(e))


def write_file(args: dict, context: dict) -> ToolResult:
    path = args.get("path")
    content = args.get("content", "")
    if not path:
        return ToolResult(False, "Missing path")
    root = _workspace(context)
    full = os.path.normpath(os.path.join(root, path))
    if not full.startswith(root):
        return ToolResult(False, "Path escapes workspace")
    try:
        os.makedirs(os.path.dirname(full) or ".", exist_ok=True)
        with open(full, "w", encoding="utf-8") as f:
            f.write(content)
        return ToolResult(True, f"Wrote {path}")
    except Exception as e:
        return ToolResult(False, str(e))


def list_dir(args: dict, context: dict) -> ToolResult:
    path = args.get("path") or "."
    root = _workspace(context)
    full = os.path.normpath(os.path.join(root, path))
    if not full.startswith(root):
        return ToolResult(False, "Path escapes workspace")
    try:
        names = os.listdir(full)
        lines = []
        for n in sorted(names):
            p = os.path.join(full, n)
            kind = "dir" if os.path.isdir(p) else "file"
            lines.append(f"  {n} ({kind})")
        return ToolResult(True, "\n".join(lines) if lines else "(empty)")
    except FileNotFoundError:
        return ToolResult(False, "Directory not found")
    except Exception as e:
        return ToolResult(False, str(e))

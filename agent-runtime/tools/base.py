"""Shared types for tools (avoids circular imports)."""


class ToolResult:
    def __init__(self, success: bool, output: str, data=None):
        self.success = success
        self.output = output
        self.data = data or {}

"""Browser tools using Playwright (headless)."""
import os
from .registry import ToolResult

_browser = None
_page = None
_last_html = None
_last_url = None


def _get_page():
    global _browser, _page
    if _page is not None:
        return _page
    from playwright.sync_api import sync_playwright
    playwright = sync_playwright().start()
    _browser = playwright.chromium.launch(headless=True)
    _page = _browser.new_page()
    _page.set_default_timeout(30000)
    return _page


def browse_page(args: dict, context: dict) -> ToolResult:
    global _last_html, _last_url
    url = args.get("url")
    if not url:
        return ToolResult(False, "Missing url")
    try:
        page = _get_page()
        page.goto(url, wait_until="domcontentloaded", timeout=25000)
        _last_url = page.url
        _last_html = page.content()
        text = page.evaluate("""() => {
            const body = document.body;
            if (!body) return '';
            const walk = (n) => {
                let out = '';
                for (const c of n.childNodes) {
                    if (c.nodeType === 3) out += c.textContent;
                    else if (c.nodeType === 1) out += walk(c);
                }
                return out;
            };
            return walk(body).replace(/\\s+/g, ' ').trim().slice(0, 50000);
        }""")
        return ToolResult(True, f"Page loaded: {_last_url}\n\nContent (excerpt):\n{text[:8000]}")
    except Exception as e:
        return ToolResult(False, str(e))


def extract_content(args: dict, context: dict) -> ToolResult:
    global _last_html, _last_url
    what = args.get("what", "text")
    if _last_html is None:
        return ToolResult(False, "No page loaded. Call browse_page first.")
    try:
        page = _get_page()
        if what == "links":
            links = page.evaluate("""() => Array.from(document.querySelectorAll('a[href]')).map(a => a.href).filter(h => h.startsWith('http'))""")
            return ToolResult(True, "Links:\n" + "\n".join(links[:200]))
        if what == "headings":
            headings = page.evaluate("""() => Array.from(document.querySelectorAll('h1,h2,h3,h4')).map(h => h.textContent.trim())""")
            return ToolResult(True, "Headings:\n" + "\n".join(headings[:100]))
        if what == "text":
            text = page.evaluate("""() => document.body ? document.body.innerText.replace(/\\s+/g, ' ').trim().slice(0, 30000) : ''""")
            return ToolResult(True, text)
        if what == "all":
            links = page.evaluate("""() => Array.from(document.querySelectorAll('a[href]')).map(a => a.href).filter(h => h.startsWith('http'))""")
            text = page.evaluate("""() => document.body ? document.body.innerText.replace(/\\s+/g, ' ').trim().slice(0, 15000) : ''""")
            return ToolResult(True, "Links:\n" + "\n".join(links[:100]) + "\n\nText:\n" + text)
        return ToolResult(False, "Unknown 'what': use links, headings, text, or all")
    except Exception as e:
        return ToolResult(False, str(e))

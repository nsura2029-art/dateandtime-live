#!/usr/bin/env python3
"""
Inject the shared site shell (header + breadcrumbs + footer) into all non-landing pages.

Pages processed:
  holidays/index.html
  onthisday/index.html
  privacy/index.html
  terms/index.html
  about/index.html
  editorial-policy/index.html

For each page:
  1. Replace any existing per-page header (legal-header, back-link div, etc.) with the shared site header
  2. Insert breadcrumbs after the header (right after </header>) for non-landing pages
  3. Add /src/site-shell.css to <head> (if not already)
  4. Add /src/site-shell.js before </body>
  5. Replace any existing per-page footer with the shared site footer
  6. Change body class to "shell-page" (instead of "legal-page" for legal pages)
  7. Keep the existing content of the page (legal-layout, h1, etc.) intact

For the landing page (index.html), we keep its richer header but use the shared footer.
"""
import os
import re
import sys
from pathlib import Path

ROOT = Path("/workspace/dateandtime-live")
SHELL = ROOT / ".shell-tmp"

# Load shell snippets
HEADER_HTML = (SHELL / "header.html").read_text().rstrip()
FOOTER_HTML = (SHELL / "footer.html").read_text().rstrip()

# Breadcrumbs per page
BREADCRUMBS = {
    "holidays/index.html": [
        ("Home", "/"),
        ("Holidays", "/holidays/"),
    ],
    "onthisday/index.html": [
        ("Home", "/"),
        ("On this day", "/onthisday/"),
    ],
    "privacy/index.html": [
        ("Home", "/"),
        ("Privacy", "/privacy/"),
    ],
    "terms/index.html": [
        ("Home", "/"),
        ("Terms", "/terms/"),
    ],
    "about/index.html": [
        ("Home", "/"),
        ("About", "/about/"),
    ],
    "editorial-policy/index.html": [
        ("Home", "/"),
        ("Editorial policy", "/editorial-policy/"),
    ],
}

PAGES = list(BREADCRUMBS.keys())

def breadcrumb_html(crumbs):
    """Build a <nav class="breadcrumbs"> block."""
    items = []
    for i, (label, href) in enumerate(crumbs):
        is_last = (i == len(crumbs) - 1)
        if is_last:
            items.append(f'        <li><a href="{href}" aria-current="page">{label}</a></li>')
        else:
            items.append(f'        <li><a href="{href}">{label}</a></li>')
    return f'''  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <div class="container">
      <ol>
{chr(10).join(items)}
      </ol>
    </div>
  </nav>
'''

# =========================================================================
# Helper: replace the body class from "legal-page" to "shell-page"
# =========================================================================
def fix_body_class(html):
    return re.sub(r'<body class="legal-page">', '<body class="shell-page">', html, count=1)

# =========================================================================
# Helper: add /src/site-shell.css to <head> if not already
# =========================================================================
def add_shell_css(html):
    if "/src/site-shell.css" in html:
        return html
    # Insert after the legal-pages.css link
    return re.sub(
        r'(<link rel="stylesheet" href="/src/legal-pages.css" />)',
        r'\1\n  <link rel="stylesheet" href="/src/site-shell.css" />',
        html,
        count=1,
    )

# =========================================================================
# Helper: add /src/site-shell.js before </body> (it sets up theme + active nav)
# =========================================================================
def add_shell_js(html):
    if "/src/site-shell.js" in html:
        return html
    # Insert before the first <script> that has actual content (or before </body>)
    return re.sub(
        r'(</body>)',
        '  <script src="/src/site-shell.js" defer></script>\n\1',
        html,
        count=1,
    )

# =========================================================================
# Helper: replace the page-specific header with the shared site header
# For legal pages: <header class="legal-header">...</header> → shared header
# For holidays/onthisday: <a class="back-link">...</a> → shared header
# =========================================================================
LEGAL_HEADER_RE = re.compile(
    r'<header class="legal-header">.*?</header>',
    re.DOTALL,
)

def replace_legal_header(html, new_header):
    return LEGAL_HEADER_RE.sub(new_header, html, count=1)

BACK_LINK_RE = re.compile(
    r'<a href="/" class="back-link">[^<]*</a>\s*\n',
    re.MULTILINE,
)

def replace_back_link(html, new_header):
    # Remove the back link and any preceding container
    html = BACK_LINK_RE.sub("", html, count=1)
    # Insert the header at the start of body
    return re.sub(
        r'(<body[^>]*>)',
        r'\1\n' + new_header,
        html,
        count=1,
    )

# =========================================================================
# Helper: replace the per-page footer with the shared site footer
# =========================================================================
LEGAL_FOOTER_RE = re.compile(
    r'<footer class="legal-footer">.*?</footer>\s*',
    re.DOTALL,
)

def replace_legal_footer(html, new_footer):
    return LEGAL_FOOTER_RE.sub(new_footer + "\n  ", html, count=1)

PAGE_FOOTER_RE = re.compile(
    r'<footer class="page-footer" role="contentinfo">.*?</footer>\s*',
    re.DOTALL,
)

def replace_page_footer(html, new_footer):
    return PAGE_FOOTER_RE.sub(new_footer + "\n  ", html, count=1)

# =========================================================================
# Per-page processors
# =========================================================================
def process_legal_page(html, page_path):
    """Process /privacy/, /terms/, /about/, /editorial-policy/."""
    html = fix_body_class(html)
    html = add_shell_css(html)
    html = replace_legal_header(html, HEADER_HTML)
    # Insert breadcrumbs after the (now replaced) </header>
    html = re.sub(
        r'(</header>\n)',
        r'\1\n' + breadcrumb_html(BREADCRUMBS[page_path]),
        html,
        count=1,
    )
    html = replace_legal_footer(html, FOOTER_HTML)
    html = add_shell_js(html)
    return html

def process_holidays_onthisday(html, page_path):
    """Process /holidays/ and /onthisday/."""
    # Add shell CSS
    if "/src/site-shell.css" not in html:
        # Find the <style> block end and add <link> after it
        html = re.sub(
            r'(</style>)',
            r'\1\n  <link rel="stylesheet" href="/src/site-shell.css" />',
            html,
            count=1,
        )
    # Replace the back-link with the shared header
    html = replace_back_link(html, HEADER_HTML)
    # Insert breadcrumbs after </header>
    html = re.sub(
        r'(</header>\n)',
        r'\1\n' + breadcrumb_html(BREADCRUMBS[page_path]),
        html,
        count=1,
    )
    # Replace the page footer
    html = replace_page_footer(html, FOOTER_HTML)
    # Add shell JS
    html = add_shell_js(html)
    return html

# =========================================================================
# Run on all pages
# =========================================================================
def main():
    for page_path in PAGES:
        full_path = ROOT / page_path
        if not full_path.exists():
            print(f"⚠ {page_path} not found")
            continue

        html = full_path.read_text()

        if page_path.endswith(("privacy/index.html", "terms/index.html",
                                "about/index.html", "editorial-policy/index.html")):
            new_html = process_legal_page(html, page_path)
        elif page_path.endswith(("holidays/index.html", "onthisday/index.html")):
            new_html = process_holidays_onthisday(html, page_path)
        else:
            print(f"⚠ Unknown page type: {page_path}")
            continue

        full_path.write_text(new_html)
        print(f"✓ {page_path}: {len(html)} → {len(new_html)} bytes")

    print()
    print("Done.")

if __name__ == "__main__":
    main()

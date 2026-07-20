# HTML Previews

> HTML mockups + design prototypes. Self-contained files you can open in a browser to preview a design BEFORE coding it into the production landing.

## 📚 Index

| Preview | Date | Status | Live URL | Notes |
|---|---|---|---|---|
| _(none yet — add your first preview here)_ | | | | |

> When you add a new preview, add a row here.

## 📝 How to add a preview

1. **Create the HTML file** with a descriptive name (kebab-case):
   ```
   docs/previews/seo-city-page-v2.html
   docs/previews/landing-redesign-A.html
   docs/previews/home-section-restructure-v1.html
   ```
2. **Keep it self-contained** — inline CSS, no external JS dependencies (or use a CDN). It should open in a browser with no build step.
3. **Add a row to the index table** above.
4. **(Optional) Host it on a preview URL** (e.g. via `website_deploy` or any static host) and add the URL in the "Live URL" column.
5. **(Optional) Link from a PRD** if the preview supports a strategy doc.

## 📐 Naming convention

| Pattern | Example | When |
|---|---|---|
| `<feature>-v<N>.html` | `seo-city-page-v2.html` | Iterating on a design |
| `<feature>-<variant>.html` | `landing-redesign-A.html` | A/B/C design comparison |
| `<feature>-prototype.html` | `home-prototype.html` | Initial exploration |

## ✅ Status meanings

| Status | Meaning |
|---|---|
| Draft | Work in progress, not ready for review |
| Review | Ready for user feedback |
| Approved | User has signed off, ready to implement |
| Shipped | This design is now in production (`index.html` or a new page) |
| Killed | Decided not to ship this design |

## 🔗 Related

- For PRDs that reference these previews, see [`../strategy/`](../strategy/)
- For the production landing these previews will become, see [`../../index.html`](../../index.html)

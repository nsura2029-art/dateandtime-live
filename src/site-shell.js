/* dateandtime.live — Shared site shell (theme toggle + breadcrumbs active state)
 *
 * Theme toggle persists choice in localStorage as 'tdl-theme'.
 * Highlights the current page in the main nav (by URL pathname).
 */
(function () {
  "use strict";

  // -------- Theme toggle --------
  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("tdl-theme", theme); } catch (e) {}
    // Update aria-pressed on theme buttons
    document.querySelectorAll("[data-theme-btn]").forEach((btn) => {
      const pressed = btn.getAttribute("data-theme-btn") === theme;
      btn.setAttribute("aria-pressed", pressed ? "true" : "false");
    });
  }

  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem("tdl-theme"); } catch (e) {}
    if (!saved) {
      saved = (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
    }
    setTheme(saved);

    // Wire up buttons
    document.querySelectorAll("[data-theme-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setTheme(btn.getAttribute("data-theme-btn"));
      });
    });
  }

  // -------- Active nav link --------
  function highlightActiveNav() {
    const path = window.location.pathname.replace(/\/$/, "") || "/";
    document.querySelectorAll(".nav-main .nav-link").forEach((link) => {
      const href = link.getAttribute("href") || "";
      let linkPath;
      try { linkPath = new URL(href, window.location.origin).pathname.replace(/\/$/, "") || "/"; }
      catch (e) { return; }
      // Active if paths match
      if (linkPath === path) {
        link.classList.add("is-active");
        link.setAttribute("aria-current", "page");
      } else if (linkPath !== "/" && path.startsWith(linkPath)) {
        link.classList.add("is-active");
        link.setAttribute("aria-current", "page");
      }
    });
  }

  function init() {
    initTheme();
    highlightActiveNav();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

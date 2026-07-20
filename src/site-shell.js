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
    try {
      // Prefer new key, fall back to old key for backwards-compat
      saved = localStorage.getItem("tdl-theme") || localStorage.getItem("tdp-theme");
      if (saved) {
        // Migrate the old key to the new one
        try { localStorage.setItem("tdl-theme", saved); localStorage.removeItem("tdp-theme"); } catch (e) {}
      }
    } catch (e) {}
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

// -------- Mobile nav (hamburger) --------
function openMobileNav() {
  const nav = document.querySelector("[data-mobile-nav]");
  const backdrop = document.querySelector("[data-nav-backdrop]");
  const toggle = document.querySelector("[data-nav-toggle]");
  if (!nav || !backdrop || !toggle) return;
  nav.hidden = false;
  backdrop.hidden = false;
  // next frame: add the class so the transition fires
  requestAnimationFrame(() => {
    nav.classList.add("is-open");
    backdrop.classList.add("is-open");
    document.body.classList.add("has-mobile-nav-open");
  });
  toggle.setAttribute("aria-expanded", "true");
  toggle.setAttribute("aria-label", "Close menu");
  // focus the first link for accessibility
  setTimeout(() => {
    const firstLink = nav.querySelector(".mobile-nav-link");
    if (firstLink) firstLink.focus();
  }, 100);
}

function closeMobileNav() {
  const nav = document.querySelector("[data-mobile-nav]");
  const backdrop = document.querySelector("[data-nav-backdrop]");
  const toggle = document.querySelector("[data-nav-toggle]");
  if (!nav || !backdrop || !toggle) return;
  nav.classList.remove("is-open");
  backdrop.classList.remove("is-open");
  document.body.classList.remove("has-mobile-nav-open");
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "Open menu");
  // wait for the transition to finish, then hide
  setTimeout(() => {
    nav.hidden = true;
    backdrop.hidden = true;
  }, 300);
  toggle.focus();
}

function initMobileNav() {
  const toggle = document.querySelector("[data-nav-toggle]");
  const closeBtn = document.querySelector("[data-nav-close]");
  const backdrop = document.querySelector("[data-nav-backdrop]");
  if (!toggle) return;

  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    if (expanded) closeMobileNav();
    else openMobileNav();
  });

  if (closeBtn) closeBtn.addEventListener("click", closeMobileNav);
  if (backdrop) backdrop.addEventListener("click", closeMobileNav);

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      closeMobileNav();
    }
  });

  // Close when a nav link is clicked
  document.querySelectorAll("[data-mobile-nav] .mobile-nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      // Only close for actual navigation, not "#" placeholders
      const href = link.getAttribute("href") || "";
      if (href && href !== "#") {
        setTimeout(closeMobileNav, 50);
      }
    });
  });

  // Highlight the active mobile nav link (same logic as desktop nav)
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  document.querySelectorAll("[data-mobile-nav] .mobile-nav-link").forEach((link) => {
    const href = link.getAttribute("href") || "";
    let linkPath;
    try { linkPath = new URL(href, window.location.origin).pathname.replace(/\/$/, "") || "/"; }
    catch (e) { return; }
    if (linkPath === path) {
      link.classList.add("is-active");
      link.setAttribute("aria-current", "page");
    } else if (linkPath !== "/" && path.startsWith(linkPath)) {
      link.classList.add("is-active");
      link.setAttribute("aria-current", "page");
    }
  });

  // Close on resize to desktop
  let lastWidth = window.innerWidth;
  window.addEventListener("resize", () => {
    if (Math.abs(window.innerWidth - lastWidth) > 50) {
      if (window.innerWidth >= 1024) closeMobileNav();
      lastWidth = window.innerWidth;
    }
  });
}

// Update init() to call initMobileNav
const _origInit = init;
init = function() {
  _origInit();
  initMobileNav();
};

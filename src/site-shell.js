/* dateandtime.live — Shared site shell
 *
 * Responsibilities (runs on every page that loads this script):
 *  1. Theme toggle (light/dark), persisted as 'tdl-theme' in localStorage
 *  2. Highlight active link in the main nav (by URL pathname)
 *  3. Mobile nav (hamburger) — open/close, escape, backdrop, link click
 *
 * Backward-compat: old 'tdp-theme' key is migrated to 'tdl-theme'.
 */
(function () {
  "use strict";

  // ====================================================================
  // THEME TOGGLE
  // ====================================================================
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

  // ====================================================================
  // ACTIVE NAV LINK (desktop + mobile)
  // ====================================================================
  function highlightActiveNav() {
    const path = window.location.pathname.replace(/\/$/, "") || "/";
    document.querySelectorAll(".nav-main .nav-link, [data-mobile-nav] .mobile-nav-link").forEach((link) => {
      const href = link.getAttribute("href") || "";
      // Skip placeholder links (href="#" or empty or "#fragment")
      // These are 'coming soon' links that don't navigate anywhere.
      // Without this, `new URL("#", origin).pathname` would be "/" and
      // would match the current path, falsely marking the link as active.
      if (!href || href === "#" || href.startsWith("#")) return;

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
  }

  // ====================================================================
  // MOBILE NAV (hamburger)
  // ====================================================================
  function openMobileNav(toggle, nav, backdrop) {
    nav.hidden = false;
    backdrop.hidden = false;
    requestAnimationFrame(() => {
      nav.classList.add("is-open");
      backdrop.classList.add("is-open");
      document.body.classList.add("has-mobile-nav-open");
    });
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
    setTimeout(() => {
      const firstLink = nav.querySelector(".mobile-nav-link");
      if (firstLink) firstLink.focus();
    }, 100);
  }

  function closeMobileNav(toggle, nav, backdrop) {
    nav.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    document.body.classList.remove("has-mobile-nav-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    setTimeout(() => {
      nav.hidden = true;
      backdrop.hidden = true;
    }, 300);
    toggle.focus();
  }

  function initMobileNav() {
    const toggle = document.querySelector("[data-nav-toggle]");
    const nav = document.querySelector("[data-mobile-nav]");
    const backdrop = document.querySelector("[data-nav-backdrop]");
    const closeBtn = document.querySelector("[data-nav-close]");
    if (!toggle || !nav || !backdrop) return;

    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      if (expanded) closeMobileNav(toggle, nav, backdrop);
      else openMobileNav(toggle, nav, backdrop);
    });

    if (closeBtn) closeBtn.addEventListener("click", () => closeMobileNav(toggle, nav, backdrop));
    if (backdrop) backdrop.addEventListener("click", () => closeMobileNav(toggle, nav, backdrop));

    // Close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        closeMobileNav(toggle, nav, backdrop);
      }
    });

    // Close when a nav link is clicked
    document.querySelectorAll("[data-mobile-nav] .mobile-nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        const href = link.getAttribute("href") || "";
        if (href && href !== "#") {
          setTimeout(() => closeMobileNav(toggle, nav, backdrop), 50);
        }
      });
    });

    // Close on resize to desktop
    let lastWidth = window.innerWidth;
    window.addEventListener("resize", () => {
      if (Math.abs(window.innerWidth - lastWidth) > 50) {
        if (window.innerWidth >= 1024) closeMobileNav(toggle, nav, backdrop);
        lastWidth = window.innerWidth;
      }
    });
  }

  // ====================================================================
  // DESKTOP DROPDOWNS (World time, Timezone)
  // ====================================================================
  function initDropdowns() {
    const items = document.querySelectorAll(".nav-item.has-dropdown");
    if (items.length === 0) return;

    let openItem = null;

    function close(item) {
      if (!item) return;
      item.classList.remove("is-open");
      const toggle = item.querySelector(".nav-dropdown-toggle");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
      if (openItem === item) openItem = null;
    }
    function open(item) {
      // Close any other open dropdown first
      if (openItem && openItem !== item) close(openItem);
      item.classList.add("is-open");
      const toggle = item.querySelector(".nav-dropdown-toggle");
      if (toggle) toggle.setAttribute("aria-expanded", "true");
      openItem = item;
    }

    items.forEach((item) => {
      const toggle = item.querySelector(".nav-dropdown-toggle");
      if (!toggle) return;
      // Click toggles open/close
      toggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (item.classList.contains("is-open")) close(item);
        else open(item);
      });
      // Keyboard: ArrowDown opens, ArrowUp/ArrowDown navigates inside
      toggle.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          open(item);
          const firstItem = item.querySelector(".dropdown-item");
          if (firstItem) firstItem.focus();
        }
        if (e.key === "Escape" && item.classList.contains("is-open")) {
          close(item);
          toggle.focus();
        }
      });
      // Inside the dropdown, ArrowDown/ArrowUp moves between items
      const dropdownItems = item.querySelectorAll(".dropdown-item");
      dropdownItems.forEach((d, i) => {
        d.addEventListener("keydown", (e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            const next = dropdownItems[i + 1] || dropdownItems[0];
            if (next) next.focus();
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            const prev = dropdownItems[i - 1] || dropdownItems[dropdownItems.length - 1];
            if (prev) prev.focus();
          } else if (e.key === "Escape") {
            close(item);
            toggle.focus();
          }
        });
      });
    });

    // Click outside closes
    document.addEventListener("click", (e) => {
      if (openItem && !openItem.contains(e.target)) close(openItem);
    });
    // Escape closes
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && openItem) {
        const t = openItem.querySelector(".nav-dropdown-toggle");
        close(openItem);
        if (t) t.focus();
      }
    });
  }

  // ====================================================================
  // BOOT
  // ====================================================================
  function init() {
    initTheme();
    highlightActiveNav();
    initMobileNav();
    initDropdowns();
    injectTodayBar();
    injectContinueStrip();
  }

  // ====================================================================
  // TODAY BAR — persistent strip under the site header on every page.
  // Shows today's date, day of year, week number, and the user's current
  // local time. Auto-updates every second. Helps users feel the live
  // nature of the site and creates a strong "this is real-time data"
  // signal.
  // ====================================================================
  function injectTodayBar() {
    // Skip pages that already have a richer header (the landing page
    // has its own hero, and city/state/country pages have their own
    // hero with the city clock).
    if (document.querySelector('[data-skip-today-bar]')) return;
    if (document.getElementById('today-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'today-bar';
    bar.setAttribute('data-today-bar', '1');
    bar.innerHTML = `
      <div class="today-bar-inner">
        <a href="/" class="today-bar-link">
          <span class="today-bar-icon" aria-hidden="true">📅</span>
          <span class="today-bar-text">
            <span class="today-bar-label">Today</span>
            <span class="today-bar-value" data-today-date>—</span>
          </span>
        </a>
        <span class="today-bar-sep" aria-hidden="true">·</span>
        <div class="today-bar-stat">
          <span class="today-bar-label">Day</span>
          <span class="today-bar-value" data-today-doy>—</span>
        </div>
        <span class="today-bar-sep" aria-hidden="true">·</span>
        <div class="today-bar-stat">
          <span class="today-bar-label">Week</span>
          <span class="today-bar-value" data-today-week>—</span>
        </div>
        <span class="today-bar-sep" aria-hidden="true">·</span>
        <div class="today-bar-stat today-bar-time">
          <span class="today-bar-label">Local</span>
          <span class="today-bar-value" data-today-time>--:--:--</span>
        </div>
        <a href="/onthisday/" class="today-bar-link today-bar-right">
          <span class="today-bar-text">
            <span class="today-bar-label">On this day</span>
            <span class="today-bar-value">3 events today →</span>
          </span>
        </a>
      </div>
    `;
    // Insert right after <header>
    const header = document.querySelector('header.site-header, .site-header, header');
    if (header && header.parentNode) {
      header.parentNode.insertBefore(bar, header.nextSibling);
    } else {
      document.body.insertBefore(bar, document.body.firstChild);
    }
    tickTodayBar();
    setInterval(tickTodayBar, 1000);
  }

  function tickTodayBar() {
    const now = new Date();
    // Use the user's local timezone (browser default).
    const dateOpts = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    const dateStr = now.toLocaleDateString('en-US', dateOpts);
    // Day of year
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    // Week number (ISO)
    const target = new Date(now.valueOf());
    const dayNr = (now.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const weekNum = 1 + Math.ceil((firstThursday - target) / (7 * 24 * 3600 * 1000));
    // Time
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const elDate = document.querySelector('[data-today-date]');
    if (elDate) elDate.textContent = dateStr;
    const elDoy = document.querySelector('[data-today-doy]');
    if (elDoy) elDoy.textContent = dayOfYear + ' / 365';
    const elWeek = document.querySelector('[data-today-week]');
    if (elWeek) elWeek.textContent = weekNum;
    const elTime = document.querySelector('[data-today-time]');
    if (elTime) elTime.textContent = timeStr;
  }

  // ====================================================================
  // CONTINUE YOUR JOURNEY — 6 cross-page link cards at the bottom of
  // every page (when there's no existing explore-grid section). Links
  // to: Today, Holidays, On this day, World time, News, Meeting. The
  // goal is to keep users in the site by showing what's next.
  // ====================================================================
  function injectContinueStrip() {
    if (document.querySelector('[data-skip-continue]')) return;
    if (document.getElementById('continue-strip')) return;
    // Find the main element to append before the footer
    const main = document.querySelector('main');
    if (!main) return;
    const strip = document.createElement('section');
    strip.id = 'continue-strip';
    strip.className = 'continue-strip';
    strip.setAttribute('data-continue-strip', '1');
    strip.innerHTML = `
      <div class="continue-strip-inner">
        <h2 class="continue-strip-title">Continue your journey</h2>
        <p class="continue-strip-sub">Wherever you are, whatever you need — explore the rest of dateandtime.live.</p>
        <div class="continue-strip-grid">
          <a href="/" class="continue-strip-card">
            <span class="continue-strip-icon" aria-hidden="true">📅</span>
            <strong>Today</strong>
            <span>What day is it? Your local time, week, and day of year.</span>
          </a>
          <a href="/holidays/" class="continue-strip-card">
            <span class="continue-strip-icon" aria-hidden="true">🎉</span>
            <strong>Holidays</strong>
            <span>Public holidays for 200+ countries, with long weekend finder.</span>
          </a>
          <a href="/onthisday/" class="continue-strip-card">
            <span class="continue-strip-icon" aria-hidden="true">📜</span>
            <strong>On this day</strong>
            <span>Historical events that happened today, from 1,000 BC to today.</span>
          </a>
          <a href="/world-time/" class="continue-strip-card">
            <span class="continue-strip-icon" aria-hidden="true">🌍</span>
            <strong>World time</strong>
            <span>Live time in 33,945 cities across 250 countries.</span>
          </a>
          <a href="/news/" class="continue-strip-card">
            <span class="continue-strip-icon" aria-hidden="true">📰</span>
            <strong>News</strong>
            <span>Latest time zone changes, DST shifts, and clock news.</span>
          </a>
          <a href="/meeting/" class="continue-strip-card">
            <span class="continue-strip-icon" aria-hidden="true">📅</span>
            <strong>Meeting planner</strong>
            <span>Find a meeting time that works across time zones.</span>
          </a>
        </div>
      </div>
    `;
    main.appendChild(strip);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

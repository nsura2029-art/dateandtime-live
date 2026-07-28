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
    // injectTodayBar() disabled 2026-07-28 — was overlapping the site
    // header (both had `position: sticky; top: 0; z-index: 50`), blocking
    // menu items. The breadcrumb is now sticky under the header instead,
    // and each page's hero shows its own live clock + local time.
    injectContinueStrip();
    injectCitySearchBar();
  }

  // ====================================================================
  // TODAY BAR — DISABLED 2026-07-28
  // Was overlapping the site header (both had `position: sticky; top: 0;
  // z-index: 50`), blocking menu items. The breadcrumb is now sticky
  // under the header instead. Functions kept (commented) for quick
  // re-enable if we want to bring it back with proper z-index handling.
  // ====================================================================
  /*
  function injectTodayBar() { ... }
  function tickTodayBar() { ... }
  */

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

  // ====================================================================
  // CITY SEARCH BAR — centered, under the breadcrumb, on every page
  // that doesn't already have one. Fetches the slim US-cities index on
  // first focus, then filters in-memory. Skips pages with a hub-level
  // search (world-time hub, home page) by checking for [data-skip-search]
  // OR a pre-existing #citySearchInput / .hub-search input.
  // ====================================================================
  function injectCitySearchBar() {
    if (document.querySelector('[data-skip-search]')) return;
    if (document.getElementById('citySearchInput')) return;
    if (document.querySelector('.hub-search input, .home-search input, .search-input')) return;
    if (!document.querySelector('main')) return;
    // Only inject on pages that look like content pages (have a main
    // element with substantial content). Skips admin pages etc.
    var main = document.querySelector('main');
    if (main.children.length === 0) return;

    var section = document.createElement('section');
    section.className = 'city-search-bar';
    section.innerHTML = `
      <label class="city-search-label" for="citySearchInput">Search another US city</label>
      <div class="city-search-wrap">
        <svg class="city-search-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
        <input type="search" id="citySearchInput" class="city-search-input" placeholder="Type a city name (e.g. Boston, Portland, San Diego)…" autocomplete="off" />
        <div class="city-search-results" id="citySearchResults" hidden></div>
      </div>
    `;
    // Insert right after the breadcrumb (which is the first thing in main)
    // or at the start of main if no breadcrumb
    var breadcrumb = main.querySelector('.breadcrumb, nav[aria-label="Breadcrumb"]');
    if (breadcrumb && breadcrumb.parentNode) {
      breadcrumb.parentNode.insertBefore(section, breadcrumb.nextSibling);
    } else {
      main.insertBefore(section, main.firstChild);
    }

    // Init search behavior on the new input
    var input = section.querySelector('#citySearchInput');
    var results = section.querySelector('#citySearchResults');
    var cities = null;
    var citiesLoading = null;

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, function(c) {
        return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
      });
    }
    function loadCities() {
      if (cities) return Promise.resolve(cities);
      if (citiesLoading) return citiesLoading;
      citiesLoading = fetch('/data/us-cities-search.json')
        .then(function(r) { return r.json(); })
        .then(function(d) { cities = d; return d; })
        .catch(function() { cities = []; return []; });
      return citiesLoading;
    }
    function search(q) {
      if (!q || q.length < 2) return [];
      var qLower = q.toLowerCase();
      var matches = [];
      for (var i = 0; i < cities.length && matches.length < 5; i++) {
        var c = cities[i];
        var n = (c.n || '').toLowerCase();
        if (n.indexOf(qLower) === 0) matches.push(c);
      }
      if (matches.length < 5) {
        for (var j = 0; j < cities.length && matches.length < 5; j++) {
          var n2 = (cities[j].n || '').toLowerCase();
          if (n2.indexOf(qLower) > 0 && matches.indexOf(cities[j]) === -1) {
            matches.push(cities[j]);
          }
        }
      }
      return matches;
    }
    function render(matches) {
      if (!matches.length) {
        results.innerHTML = '<div class="city-search-empty">No matches. Try another city.</div>';
        results.hidden = false;
        return;
      }
      results.innerHTML = matches.map(function(m) {
        return '<a class="city-search-result" href="/world-time/united-states/' + m.s + '/">'
          + '<span class="city-search-result-name">' + escapeHtml(m.n) + '</span>'
          + '<span class="city-search-result-meta">' + escapeHtml(m.sc || '') + ' · ' + escapeHtml(m.p || '') + '</span>'
          + '</a>';
      }).join('');
      results.hidden = false;
    }
    input.addEventListener('focus', loadCities);
    input.addEventListener('input', function() {
      var q = input.value.trim();
      if (q.length < 2) { results.hidden = true; return; }
      loadCities().then(function() { render(search(q)); });
    });
    document.addEventListener('click', function(e) {
      if (!input.contains(e.target) && !results.contains(e.target)) results.hidden = true;
    });
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') { results.hidden = true; input.blur(); }
      if (e.key === 'Enter') {
        var first = results.querySelector('.city-search-result');
        if (first) window.location.href = first.getAttribute('href');
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

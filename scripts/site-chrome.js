// Shared site chrome (header + mobile nav + footer) used by all build
// scripts and the Worker-generated coming-soon page. Source of truth: the
// home page (index.html). Any change here propagates to:
//   - src/index.js (generateComingSoonPage)
//   - scripts/build-us-cities-lite.js (15,994 US city pages)
//   - scripts/build-country-state-pages.js (242 country + 2,551 state pages)
//   - scripts/build-news.js (news pages)
// Keep in sync with the home page header.

// ============================================================================
// HEADER
// ============================================================================
// `active` = path of the current page (e.g. "/world-time/", "/holidays/")
//           for highlighting the matching nav item. Pass null for pages that
//           don't have a direct match (the dropdown parent gets active state).
// `country` = optional {slug, name, href} — if set, adds a "All {country}
//              cities" link to the World time dropdown.
function buildHeader(active, country) {
  active = active || "";
  country = country || null;
  const isActive = (path) => active === path ? " active" : "";
  // For the World time / Timezone dropdown parents, mark active when on any
  // descendant of that section.
  const isWorldTimeActive = active.startsWith("/world-time/") || active === "/world-time" ? " active" : "";
  const isTimezoneActive = active.startsWith("/time-zones/") || active === "/time-zones" ? " active" : "";
  const ariaCurrentWorldTime = isWorldTimeActive ? ' aria-current="page"' : "";
  const ariaCurrentTimezone = isTimezoneActive ? ' aria-current="page"' : "";
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Optional country link in the World time dropdown (for country pages).
  const countryDropdownItem = country
    ? `<a href="${esc(country.href)}" class="dropdown-item${active === country.href ? " active" : ""}" role="menuitem"${active === country.href ? ' aria-current="page"' : ""}>
              <span class="dropdown-title"><span class="dropdown-icon world" aria-hidden="true">🌍</span>${esc(country.name)}</span>
              <span class="dropdown-desc">All ${esc(country.name)} cities</span>
            </a>`
    : "";

  return `<header class="site-header">
    <div class="container header-row">
      <a href="/" class="logo" aria-label="dateandtime.live home">
        <span class="logo-mark">T</span>
        <span class="logo-text"><span class="logo-text-domain">dateandtime</span><span class="logo-text-tld">.live</span></span>
      </a>
      <nav class="nav-main" aria-label="Main">
        <a href="#" class="nav-link" title="Today page — coming soon"><span class="now-dot" aria-hidden="true"></span>Today</a>
        <a href="/holidays/" class="nav-link${isActive("/holidays/")}">Holidays</a>
        <a href="/onthisday/" class="nav-link${isActive("/onthisday/")}">On this day</a>
        <a href="/world-time/meeting/" class="nav-link${isActive("/world-time/meeting/")}">Meeting finder</a>
        <div class="nav-item has-dropdown">
          <button class="nav-link nav-dropdown-toggle" aria-haspopup="true" aria-expanded="false"${ariaCurrentWorldTime}>
            <span class="nav-icon" aria-hidden="true">🕐</span>World time
            <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="nav-dropdown" role="menu">
            <a href="/world-time/" class="dropdown-item${isActive("/world-time/")}" role="menuitem">
              <span class="dropdown-title"><span class="dropdown-icon world" aria-hidden="true">🕐</span>The World Clock</span>
              <span class="dropdown-desc">Live current time in 33,945 cities</span>
            </a>
            ${countryDropdownItem}
            <a href="/world-time/meeting/" class="dropdown-item${isActive("/world-time/meeting/")}" role="menuitem">
              <span class="dropdown-title"><span class="dropdown-icon world" aria-hidden="true">📅</span>Meeting Planner</span>
              <span class="dropdown-desc">Find meeting times across time zones</span>
            </a>
            <a href="/world-time/event/" class="dropdown-item${isActive("/world-time/event/")}" role="menuitem">
              <span class="dropdown-title"><span class="dropdown-icon world" aria-hidden="true">📣</span>Event Time Announcer</span>
              <span class="dropdown-desc">Show local times for a global event</span>
            </a>
            <div class="dropdown-divider"></div>
            <div class="dropdown-section-label">Learn</div>
            <a href="/world-time/about/" class="dropdown-item${isActive("/world-time/about/")}" role="menuitem">
              <span class="dropdown-title"><span class="dropdown-icon world" aria-hidden="true">💡</span>What is a World Clock?</span>
              <span class="dropdown-desc">How live world clocks work</span>
            </a>
          </div>
        </div>
        <div class="nav-item has-dropdown">
          <button class="nav-link nav-dropdown-toggle" aria-haspopup="true" aria-expanded="false"${ariaCurrentTimezone}>
            <span class="nav-icon" aria-hidden="true">🌐</span>Timezone
            <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="nav-dropdown" role="menu">
            <a href="/time-zones/" class="dropdown-item${isActive("/time-zones/")}" role="menuitem">
              <span class="dropdown-title"><span class="dropdown-icon tz" aria-hidden="true">🌐</span>Time Zones</span>
              <span class="dropdown-desc">Browse all 408 time zones</span>
            </a>
            <a href="/time-zones/converter/" class="dropdown-item${isActive("/time-zones/converter/")}" role="menuitem">
              <span class="dropdown-title"><span class="dropdown-icon tz" aria-hidden="true">🔄</span>Time Zone Converter</span>
              <span class="dropdown-desc">Time difference calculator</span>
            </a>
            <a href="/time-zones/in/" class="dropdown-item${isActive("/time-zones/in/")}" role="menuitem">
              <span class="dropdown-title"><span class="dropdown-icon tz" aria-hidden="true">🗺️</span>Time Zones in [Country]</span>
              <span class="dropdown-desc">All countries and their zones</span>
            </a>
            <div class="dropdown-divider"></div>
            <div class="dropdown-section-label">Learn</div>
            <a href="/time-zones/what-is/" class="dropdown-item${isActive("/time-zones/what-is/")}" role="menuitem">
              <span class="dropdown-title"><span class="dropdown-icon tz" aria-hidden="true">💡</span>What is a Time Zone?</span>
              <span class="dropdown-desc">UTC, offsets, and the prime meridian</span>
            </a>
            <a href="/time-zones/dst/" class="dropdown-item${isActive("/time-zones/dst/")}" role="menuitem">
              <span class="dropdown-title"><span class="dropdown-icon tz" aria-hidden="true">⏰</span>Daylight Saving Time</span>
              <span class="dropdown-desc">Spring forward, fall back</span>
            </a>
            <a href="/time-zones/utc/" class="dropdown-item${isActive("/time-zones/utc/")}" role="menuitem">
              <span class="dropdown-title"><span class="dropdown-icon tz" aria-hidden="true">🛰️</span>UTC &amp; GMT</span>
              <span class="dropdown-desc">The world's time standard</span>
            </a>
          </div>
        </div>
        <a href="/news/" class="nav-link${isActive("/news/")}">News</a>
      </nav>
      <div class="header-actions">
        <div class="theme-toggle" role="group" aria-label="Theme">
          <button data-theme-btn="light" aria-pressed="true" aria-label="Light mode" title="Light mode">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
          </button>
          <button data-theme-btn="dark" aria-pressed="false" aria-label="Dark mode" title="Dark mode">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>
        </div>
        <button class="nav-toggle" data-nav-toggle aria-expanded="false" aria-controls="mobile-nav" aria-label="Open menu">
          <span class="nav-toggle-icon" aria-hidden="true">
            <span></span><span></span><span></span>
          </span>
        </button>
      </div>
    </div>
  </header>

  <div class="mobile-nav-backdrop" data-nav-backdrop hidden></div>
  <aside class="mobile-nav" id="mobile-nav" data-mobile-nav aria-label="Mobile navigation" hidden>
    <div class="mobile-nav-header">
      <a href="/" class="mobile-nav-logo" aria-label="dateandtime.live home">
        <span class="logo-mark">T</span>
        <span class="logo-text"><span class="logo-text-domain">dateandtime</span><span class="logo-text-tld">.live</span></span>
      </a>
      <button class="mobile-nav-close" data-nav-close aria-label="Close menu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <nav class="mobile-nav-list" aria-label="Mobile main">
      <a href="#" class="mobile-nav-link" title="Today page — coming soon"><span class="now-dot" aria-hidden="true"></span>Today</a>
      <a href="/holidays/" class="mobile-nav-link">Holidays</a>
      <a href="/onthisday/" class="mobile-nav-link">On this day</a>
      <a href="/world-time/meeting/" class="mobile-nav-link">Meeting finder</a>
      <div class="mobile-nav-section">World time</div>
      <a href="/world-time/" class="mobile-nav-link mobile-nav-sub">The World Clock</a>
      ${country ? `<a href="${esc(country.href)}" class="mobile-nav-link mobile-nav-sub">${esc(country.name)}</a>` : ""}
      <a href="/world-time/meeting/" class="mobile-nav-link mobile-nav-sub">Meeting Planner</a>
      <a href="/world-time/event/" class="mobile-nav-link mobile-nav-sub">Event Time Announcer</a>
      <div class="mobile-nav-section">Timezone</div>
      <a href="/time-zones/" class="mobile-nav-link mobile-nav-sub">Time Zones</a>
      <a href="/time-zones/converter/" class="mobile-nav-link mobile-nav-sub">Time Zone Converter</a>
      <a href="/time-zones/in/" class="mobile-nav-link mobile-nav-sub">Time Zones in [Country]</a>
      <a href="/time-zones/what-is/" class="mobile-nav-link mobile-nav-sub">What is a Time Zone?</a>
      <a href="/time-zones/dst/" class="mobile-nav-link mobile-nav-sub">Daylight Saving Time</a>
      <a href="/news/" class="mobile-nav-link">News</a>
    </nav>
  </aside>`;
}

// ============================================================================
// FOOTER
// ============================================================================
// `cityLine` = optional string like "Tampa, Florida, United States" to
//              add a city-specific line at the top of the footer meta.
function buildFooter(cityLine) {
  const cityPart = cityLine ? `dateandtime.live — ${cityLine} · ` : "dateandtime.live — ";
  return `<footer class="site-footer" role="contentinfo">
    <div class="site-footer-inner">
      <nav class="site-footer-nav" aria-label="Site links">
        <a href="/">Home</a>
        <a href="/holidays/">Holidays</a>
        <a href="/onthisday/">On this day</a>
        <a href="/about/">About</a>
        <a href="/editorial-policy/">Editorial policy</a>
        <a href="/privacy/">Privacy</a>
        <a href="/terms/">Terms</a>
        <a href="mailto:hello@dateandtime.live">Contact</a>
        <a href="/sitemap.xml">Sitemap</a>
      </nav>
      <p class="site-footer-meta">
        © 2026 ${cityPart}33,945 cities · 408 time zones · 1,600+ holidays ·
        Data: <a href="/editorial-policy/">IANA · GeoNames · Nager.Date · Wikipedia</a>
      </p>
      <p class="site-footer-meta">
        <a href="#" data-action="do-not-sell">Do Not Sell or Share My Personal Information</a> (CCPA)
      </p>
    </div>
  </footer>`;
}

module.exports = { buildHeader, buildFooter };

/* dateandtime.live — Cookie consent banner
 *
 * Reads/writes the `cookie_consent` cookie. Shows a banner on first visit.
 * Categories: essential (always on), analytics (opt-in), advertising (opt-in).
 *
 * The Worker injects the banner HTML + window.__consentRegion + window.__hasConsent
 * before this script runs. So we just wire up the buttons.
 */
(function () {
  "use strict";

  const COOKIE_NAME = "cookie_consent";
  const COOKIE_VERSION = 1;
  const MAX_AGE = 60 * 60 * 24 * 365; // 12 months

  // -------- Cookie helpers --------
  function setCookie(value) {
    const payload = encodeURIComponent(JSON.stringify(value));
    document.cookie = `${COOKIE_NAME}=${payload}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax`;
  }

  function getCookie() {
    const match = document.cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    if (!match) return null;
    try { return JSON.parse(decodeURIComponent(match[1])); } catch { return null; }
  }

  // -------- Banner show/hide --------
  function showBanner() {
    const banner = document.getElementById("cookie-banner");
    if (banner) banner.classList.remove("is-hidden");
  }

  function hideBanner() {
    const banner = document.getElementById("cookie-banner");
    if (banner) {
      banner.classList.add("is-hidden");
      banner.setAttribute("aria-hidden", "true");
    }
  }

  function showCustomize() {
    const panel = document.getElementById("cookie-customize");
    if (panel) panel.classList.remove("is-hidden");
  }

  function hideCustomize() {
    const panel = document.getElementById("cookie-customize");
    if (panel) panel.classList.add("is-hidden");
  }

  // -------- Save consent --------
  function saveConsent(consent) {
    const value = {
      v: COOKIE_VERSION,
      essential: true, // always true
      analytics: !!consent.analytics,
      advertising: !!consent.advertising,
      ts: new Date().toISOString()
    };
    setCookie(value);
    window.__hasConsent = value;
    hideBanner();
    hideCustomize();
    // Reload so any gated scripts can load
    // (only if the user actually enabled something new)
    if (consent.analytics || consent.advertising) {
      // Don't reload — the page can request any newly-enabled scripts lazily
      // But for the moment we keep it simple: just save.
    }
  }

  function saveEssentialOnly() {
    saveConsent({ essential: true, analytics: false, advertising: false });
  }

  function saveAcceptAll() {
    saveConsent({ essential: true, analytics: true, advertising: true });
  }

  function saveCustom() {
    const analytics = document.querySelector('[data-category="analytics"]')?.checked || false;
    const advertising = document.querySelector('[data-category="advertising"]')?.checked || false;
    saveConsent({ essential: true, analytics, advertising });
  }

  // -------- "Do Not Sell" (CCPA) --------
  function doNotSell() {
    const current = getCookie() || { essential: true, analytics: false, advertising: false, v: COOKIE_VERSION };
    current.advertising = false;
    current.ts = new Date().toISOString();
    setCookie(current);
    window.__hasConsent = current;
    hideBanner();
    hideCustomize();
    // Show a small confirmation
    alert("We've recorded your preference. Non-essential advertising cookies are disabled.");
  }

  // -------- Wire up buttons --------
  function init() {
    const consent = window.__hasConsent || getCookie();

    // If we have a valid consent record, don't show the banner
    if (consent && consent.v === COOKIE_VERSION && typeof consent.essential === "boolean") {
      hideBanner();
      return;
    }

    // Otherwise, show the banner
    showBanner();

    // Wire up buttons
    document.querySelectorAll("[data-consent]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const action = btn.getAttribute("data-consent");
        if (action === "essential") saveEssentialOnly();
        else if (action === "all") saveAcceptAll();
        else if (action === "customize") showCustomize();
        else if (action === "save") saveCustom();
      });
    });

    // Wire up "Customize" link
    document.querySelectorAll('[data-action="show-customize"]').forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        showCustomize();
      });
    });

    // Wire up "Do Not Sell" link (CCPA)
    document.querySelectorAll('[data-action="do-not-sell"]').forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        doNotSell();
      });
    });
  }

  // Wait for DOM (this script is loaded at the end of <body>, so DOM is ready)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

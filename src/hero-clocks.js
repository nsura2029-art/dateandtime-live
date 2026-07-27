// Hero clocks section — 6 cities, each rendered as a different historical
// clock type (sundial, hourglass, pendulum, marine chronometer, quartz, atomic).
// All clocks show real local time with millisecond precision.
//
// Pure SVG + CSS animation. JS only updates time/angle on a single rAF loop
// (one timer per clock card), so 6 clocks × 60fps = ~360 ops/sec. Trivial.
//
// Cities array is passed in (world-time vs US page can have different cities).

(function() {
  "use strict";

  // ===========================================================================
  // Clock SVG templates
  // ===========================================================================
  // Each returns an SVG element string. Hands/display are updated by JS, NOT
  // by CSS animation, so the clocks always show real time. Animations are
  // limited to ambient effects (pendulum swing, sand fall, glow).

  const SVG_NS = "http://www.w3.org/2000/svg";

  // ---- 1. SUNDIAL ----
  // A circular dial with hour marks, a triangular gnomon, and a shadow polygon.
  // The shadow angle is set to match the actual sun position:
  //   sunAngle = ((hour % 12) + minute/60) * 30° - 90° (north = -Y)
  // Note: a real sundial uses solar time, not clock time. For visual fidelity
  // we just rotate the shadow once per second to track the clock — close enough
  // for a "this is a sundial" effect.
  function svgSundial() {
    // 12 hour marks as small lines on a circle of radius 70
    let marks = "";
    for (let i = 0; i < 12; i++) {
      const a = (i * 30 - 90) * Math.PI / 180;
      const x1 = 100 + Math.cos(a) * 70;
      const y1 = 100 + Math.sin(a) * 70;
      const x2 = 100 + Math.cos(a) * 60;
      const y2 = 100 + Math.sin(a) * 60;
      marks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;
      // Hour numerals
      const tx = 100 + Math.cos(a) * 50;
      const ty = 100 + Math.sin(a) * 50;
      const num = i === 0 ? 12 : i;
      marks += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="9" font-weight="700" fill="currentColor" opacity="0.6">${num}</text>`;
    }
    return `<svg viewBox="0 0 200 200" class="clock-svg clock-sundial" aria-hidden="true">
      <defs>
        <radialGradient id="sundial-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="currentColor" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="currentColor" stop-opacity="0.02"/>
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="80" fill="url(#sundial-grad)" stroke="currentColor" stroke-width="1.5" stroke-opacity="0.4"/>
      ${marks}
      <!-- Gnomon (triangle pointing up from center) -->
      <polygon points="100,100 92,108 108,108" fill="currentColor" opacity="0.8"/>
      <!-- Shadow (will be rotated by JS) -->
      <g class="sundial-shadow">
        <polygon points="100,100 200,98 200,102" fill="currentColor" opacity="0.4"/>
      </g>
      <!-- Center dot -->
      <circle cx="100" cy="100" r="2.5" fill="currentColor"/>
    </svg>`;
  }

  // ---- 2. HOURGLASS ----
  // Two triangles joined at the center, sand particles falling.
  // The top triangle slowly drains (using a clip-path on the upper triangle)
  // and the bottom fills. A flip animation runs every "minute" (30s for demo).
  function svgHourglass() {
    return `<svg viewBox="0 0 200 200" class="clock-svg clock-hourglass" aria-hidden="true">
      <defs>
        <clipPath id="hg-top-clip">
          <rect class="hg-top-mask" x="0" y="0" width="200" height="100"/>
        </clipPath>
        <clipPath id="hg-bottom-clip">
          <rect class="hg-bottom-mask" x="0" y="100" width="200" height="100"/>
        </clipPath>
      </defs>
      <!-- Frame -->
      <rect x="60" y="20" width="80" height="160" rx="4" fill="none" stroke="currentColor" stroke-width="3" opacity="0.3"/>
      <line x1="55" y1="20" x2="145" y2="20" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
      <line x1="55" y1="180" x2="145" y2="180" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
      <!-- Top triangle (sand source) -->
      <polygon points="100,100 65,25 135,25" fill="currentColor" opacity="0.7" clip-path="url(#hg-top-clip)"/>
      <!-- Bottom triangle (sand pile) -->
      <polygon points="100,100 65,175 135,175" fill="currentColor" opacity="0.5" clip-path="url(#hg-bottom-clip)"/>
      <!-- Falling sand stream -->
      <line class="hg-stream" x1="100" y1="100" x2="100" y2="175" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
      <!-- Falling particles -->
      <circle class="hg-particle hg-p1" cx="100" cy="105" r="1.5" fill="currentColor" opacity="0.7"/>
      <circle class="hg-particle hg-p2" cx="100" cy="125" r="1.5" fill="currentColor" opacity="0.7"/>
      <circle class="hg-particle hg-p3" cx="100" cy="145" r="1.5" fill="currentColor" opacity="0.7"/>
      <circle class="hg-particle hg-p4" cx="100" cy="165" r="1.5" fill="currentColor" opacity="0.7"/>
    </svg>`;
  }

  // ---- 3. PENDULUM ----
  // A circle (bob) on a swinging rod. The bob's position is purely CSS-animated
  // (CSS keyframes); the clock face behind shows the actual time via hour/minute
  // hands. Two animations in one: the pendulum swing (CSS) and the time
  // (JS updates the hands).
  function svgPendulum() {
    let marks = "";
    for (let i = 0; i < 12; i++) {
      const a = (i * 30 - 90) * Math.PI / 180;
      const x1 = 100 + Math.cos(a) * 70;
      const y1 = 100 + Math.sin(a) * 70;
      const x2 = 100 + Math.cos(a) * 60;
      const y2 = 100 + Math.sin(a) * 60;
      marks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5"/>`;
    }
    return `<svg viewBox="0 0 200 200" class="clock-svg clock-pendulum" aria-hidden="true">
      <!-- Clock face (background, smaller — pendulum is the star) -->
      <circle cx="100" cy="80" r="38" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>
      ${marks}
      <!-- Hour hand -->
      <line class="pend-hour" x1="100" y1="80" x2="100" y2="62" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Minute hand -->
      <line class="pend-minute" x1="100" y1="80" x2="100" y2="50" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="100" cy="80" r="2" fill="currentColor"/>
      <!-- Pendulum rod + bob (CSS animated swing) -->
      <g class="pendulum-swing">
        <line x1="100" y1="80" x2="100" y2="155" stroke="currentColor" stroke-width="2" opacity="0.8"/>
        <circle cx="100" cy="170" r="14" fill="currentColor" opacity="0.85"/>
        <circle cx="100" cy="170" r="10" fill="currentColor" opacity="0.3"/>
      </g>
    </svg>`;
  }

  // ---- 4. MARINE CHRONOMETER ----
  // Pocket-watch style: large round dial with hour marks, three hands
  // (hour, minute, second), and a small subsidiary seconds dial.
  function svgChronometer() {
    let marks = "";
    for (let i = 0; i < 12; i++) {
      const a = (i * 30 - 90) * Math.PI / 180;
      const x1 = 100 + Math.cos(a) * 72;
      const y1 = 100 + Math.sin(a) * 72;
      const x2 = 100 + Math.cos(a) * 62;
      const y2 = 100 + Math.sin(a) * 62;
      marks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;
      // Roman numerals
      const romans = ["XII","I","II","III","IV","V","VI","VII","VIII","IX","X","XI"];
      const tx = 100 + Math.cos(a) * 50;
      const ty = 100 + Math.sin(a) * 50;
      marks += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="600" fill="currentColor" font-family="serif">${romans[i]}</text>`;
    }
    return `<svg viewBox="0 0 200 200" class="clock-svg clock-chrono" aria-hidden="true">
      <!-- Outer case -->
      <circle cx="100" cy="100" r="88" fill="none" stroke="currentColor" stroke-width="3" opacity="0.4"/>
      <circle cx="100" cy="100" r="84" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"/>
      <!-- Crown (winding stem) at 12 o'clock -->
      <rect x="96" y="6" width="8" height="10" rx="1" fill="currentColor" opacity="0.5"/>
      <!-- Dial face -->
      <circle cx="100" cy="100" r="78" fill="currentColor" fill-opacity="0.04" stroke="currentColor" stroke-width="0.5" stroke-opacity="0.3"/>
      ${marks}
      <!-- Hour hand (short, thick) -->
      <line class="chrono-hour" x1="100" y1="100" x2="100" y2="60" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
      <!-- Minute hand (long, thinner) -->
      <line class="chrono-minute" x1="100" y1="100" x2="100" y2="35" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Second hand (sweeping) -->
      <line class="chrono-second" x1="100" y1="115" x2="100" y2="40" stroke="#ff7a59" stroke-width="1.2" stroke-linecap="round" opacity="0.85"/>
      <!-- Center pin -->
      <circle cx="100" cy="100" r="4" fill="currentColor"/>
      <circle cx="100" cy="100" r="1.5" fill="#ff7a59"/>
    </svg>`;
  }

  // ---- 5. WATER CLOCK (Clepsydra) ----
  // Ancient timekeeping device with water dripping from an upper chamber
  // into a lower vessel. The water level in the lower vessel indicates
  // the hour. Animated drips + a slowly rising water level.
  function svgWaterClock() {
    return `<svg viewBox="0 0 200 200" class="clock-svg clock-water" aria-hidden="true">
      <defs>
        <linearGradient id="water-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="currentColor" stop-opacity="0.7"/>
          <stop offset="100%" stop-color="currentColor" stop-opacity="0.4"/>
        </linearGradient>
      </defs>
      <!-- Decorative column / frame (left) -->
      <rect x="25" y="20" width="8" height="100" fill="currentColor" opacity="0.45"/>
      <circle cx="29" cy="20" r="6" fill="currentColor" opacity="0.5"/>
      <!-- Decorative column / frame (right) -->
      <rect x="167" y="20" width="8" height="100" fill="currentColor" opacity="0.45"/>
      <circle cx="171" cy="20" r="6" fill="currentColor" opacity="0.5"/>
      <!-- Top lintel -->
      <rect x="20" y="14" width="160" height="10" rx="2" fill="currentColor" opacity="0.5"/>
      <!-- Upper reservoir (water source) -->
      <path d="M 50 40 L 150 40 L 145 70 L 55 70 Z" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-width="2" opacity="0.7"/>
      <!-- Upper water level (animated rising then dropping) -->
      <rect class="water-upper" x="58" y="60" width="84" height="9" fill="url(#water-grad)" opacity="0.6"/>
      <!-- Drip hole + spout -->
      <circle cx="100" cy="72" r="3" fill="currentColor"/>
      <line x1="100" y1="72" x2="100" y2="92" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
      <!-- Dripping droplets (animated fall) -->
      <circle class="water-drip water-drip-1" cx="100" cy="78" r="1.8" fill="currentColor" opacity="0.7"/>
      <circle class="water-drip water-drip-2" cx="100" cy="98" r="1.8" fill="currentColor" opacity="0.7"/>
      <circle class="water-drip water-drip-3" cx="100" cy="115" r="1.8" fill="currentColor" opacity="0.7"/>
      <!-- Lower bowl (collects water) -->
      <path d="M 30 130 Q 30 175 100 180 Q 170 175 170 130 L 155 130 Q 155 168 100 172 Q 45 168 45 130 Z"
            fill="currentColor" fill-opacity="0.12" stroke="currentColor" stroke-width="2" opacity="0.7"/>
      <!-- Lower water level (rises as drips accumulate) -->
      <path class="water-lower" d="M 35 165 Q 35 175 100 178 Q 165 175 165 165 Z"
            fill="url(#water-grad)" opacity="0.7"/>
      <!-- Time indicators on the lower bowl (hour marks) -->
      <line x1="35" y1="140" x2="40" y2="140" stroke="currentColor" stroke-width="1.5" opacity="0.7"/>
      <line x1="35" y1="155" x2="40" y2="155" stroke="currentColor" stroke-width="1.5" opacity="0.7"/>
      <line x1="35" y1="170" x2="40" y2="170" stroke="currentColor" stroke-width="1.5" opacity="0.7"/>
      <line x1="160" y1="140" x2="165" y2="140" stroke="currentColor" stroke-width="1.5" opacity="0.7"/>
      <line x1="160" y1="155" x2="165" y2="155" stroke="currentColor" stroke-width="1.5" opacity="0.7"/>
      <line x1="160" y1="170" x2="165" y2="170" stroke="currentColor" stroke-width="1.5" opacity="0.7"/>
    </svg>`;
  }

  // ---- 6. QUARTZ (aesthetic gear clock style) ----
  // Inspired by the Gears Clock kinetic art: visible brass & steel gears
  // mesh together to drive the hands. The hands themselves are sleek
  // black spade/lozenge shapes against an aged-bronze dial.
  function svgQuartz() {
    return `<svg viewBox="0 0 200 200" class="clock-svg clock-quartz" aria-hidden="true">
      <defs>
        <radialGradient id="quartz-dial" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="currentColor" stop-opacity="0.18"/>
          <stop offset="80%" stop-color="currentColor" stop-opacity="0.04"/>
          <stop offset="100%" stop-color="currentColor" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <!-- Outer case -->
      <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" stroke-width="2" opacity="0.55"/>
      <circle cx="100" cy="100" r="88" fill="none" stroke="currentColor" stroke-width="0.6" opacity="0.35"/>
      <!-- Dial face -->
      <circle cx="100" cy="100" r="84" fill="url(#quartz-dial)"/>
      <!-- Roman numerals around the dial -->
      <text x="100" y="34"  text-anchor="middle" font-size="14" font-weight="600" font-family="serif" fill="currentColor" opacity="0.7">XII</text>
      <text x="165" y="106" text-anchor="middle" font-size="14" font-weight="600" font-family="serif" fill="currentColor" opacity="0.7">III</text>
      <text x="100" y="178" text-anchor="middle" font-size="14" font-weight="600" font-family="serif" fill="currentColor" opacity="0.7">VI</text>
      <text x="35"  y="106" text-anchor="middle" font-size="14" font-weight="600" font-family="serif" fill="currentColor" opacity="0.7">IX</text>
      <text x="148" y="48"  text-anchor="middle" font-size="11" font-weight="600" font-family="serif" fill="currentColor" opacity="0.55">I</text>
      <text x="172" y="73"  text-anchor="middle" font-size="11" font-weight="600" font-family="serif" fill="currentColor" opacity="0.55">II</text>
      <text x="172" y="138" text-anchor="middle" font-size="11" font-weight="600" font-family="serif" fill="currentColor" opacity="0.55">IV</text>
      <text x="148" y="162" text-anchor="middle" font-size="11" font-weight="600" font-family="serif" fill="currentColor" opacity="0.55">V</text>
      <text x="52"  y="162" text-anchor="middle" font-size="11" font-weight="600" font-family="serif" fill="currentColor" opacity="0.55">VII</text>
      <text x="28"  y="138" text-anchor="middle" font-size="11" font-weight="600" font-family="serif" fill="currentColor" opacity="0.55">VIII</text>
      <text x="28"  y="73"  text-anchor="middle" font-size="11" font-weight="600" font-family="serif" fill="currentColor" opacity="0.55">X</text>
      <text x="52"  y="48"  text-anchor="middle" font-size="11" font-weight="600" font-family="serif" fill="currentColor" opacity="0.55">XI</text>
      <!-- Visible gears (aesthetic, like a skeleton clock) -->
      <g class="quartz-gears" opacity="0.55">
        <g class="quartz-gear-1" transform="translate(45 50)">
          <circle r="18" fill="none" stroke="currentColor" stroke-width="1.4"/>
          <circle r="5" fill="currentColor"/>
          <line x1="-15" y1="0" x2="15" y2="0" stroke="currentColor" stroke-width="1"/>
          <line x1="0" y1="-15" x2="0" y2="15" stroke="currentColor" stroke-width="1"/>
          <line x1="-10.6" y1="-10.6" x2="10.6" y2="10.6" stroke="currentColor" stroke-width="0.7"/>
          <line x1="-10.6" y1="10.6" x2="10.6" y2="-10.6" stroke="currentColor" stroke-width="0.7"/>
        </g>
        <g class="quartz-gear-2" transform="translate(155 145)">
          <circle r="14" fill="none" stroke="currentColor" stroke-width="1.2"/>
          <circle r="4" fill="currentColor"/>
          <line x1="-11.5" y1="0" x2="11.5" y2="0" stroke="currentColor" stroke-width="0.9"/>
          <line x1="0" y1="-11.5" x2="0" y2="11.5" stroke="currentColor" stroke-width="0.9"/>
        </g>
        <g class="quartz-gear-3" transform="translate(155 60)">
          <circle r="9" fill="none" stroke="currentColor" stroke-width="1"/>
          <circle r="3" fill="currentColor"/>
          <line x1="-7" y1="0" x2="7" y2="0" stroke="currentColor" stroke-width="0.7"/>
          <line x1="0" y1="-7" x2="0" y2="7" stroke="currentColor" stroke-width="0.7"/>
        </g>
      </g>
      <!-- Hour hand (short, thick) -->
      <line class="chrono-hour" x1="100" y1="100" x2="100" y2="60" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
      <!-- Minute hand (long, thinner) -->
      <line class="chrono-minute" x1="100" y1="100" x2="100" y2="35" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Second hand (sweeping) -->
      <line class="chrono-second" x1="100" y1="115" x2="100" y2="40" stroke="#ff7a59" stroke-width="1.2" stroke-linecap="round" opacity="0.85"/>
      <!-- Center pin -->
      <circle cx="100" cy="100" r="3.5" fill="currentColor"/>
      <circle cx="100" cy="100" r="1.2" fill="#ff7a59"/>
    </svg>`;
  }

  // ---- 6. ATOMIC ----
  // Precise digital readout HH:MM:SS.mmm. The .mmm is the wow factor.
  // Subtle glow indicates the cesium-133 transition reference.
  function svgAtomic() {
    return `<svg viewBox="0 0 200 200" class="clock-svg clock-atomic" aria-hidden="true">
      <defs>
        <filter id="atomic-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <!-- Display panel -->
      <rect x="15" y="55" width="170" height="90" rx="8" fill="currentColor" fill-opacity="0.04" stroke="currentColor" stroke-width="2" opacity="0.7"/>
      <!-- Time with ms (updated by JS) -->
      <text class="atomic-time" x="100" y="98" text-anchor="middle" dominant-baseline="central"
            font-family="ui-monospace, 'SF Mono', monospace" font-size="24" font-weight="800"
            fill="currentColor" filter="url(#atomic-glow)" letter-spacing="1">--:--:--.---</text>
      <!-- Cs-133 reference label -->
      <text x="100" y="68" text-anchor="middle" font-size="6" font-weight="600" letter-spacing="2" fill="currentColor" opacity="0.5">Cs-133 9,192,631,770 Hz</text>
      <text x="100" y="130" text-anchor="middle" font-size="7" font-weight="500" letter-spacing="1.5" fill="currentColor" opacity="0.4">NIST ATOMIC · UTC(NIST)</text>
      <!-- Jitter indicator (live dot, pulses every second) -->
      <circle class="atomic-pulse" cx="20" cy="68" r="2" fill="#00d4aa"/>
    </svg>`;
  }

  const SVG_RENDERERS = {
    sundial: svgSundial,
    hourglass: svgHourglass,
    pendulum: svgPendulum,
    chrono: svgChronometer,
    water: svgWaterClock,
    quartz: svgQuartz,
    atomic: svgAtomic
  };

  // ===========================================================================
  // Time helpers
  // ===========================================================================

  // Format integer as 2-digit string ("7" → "07", "12" → "12")
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function pad3(n) { return n < 10 ? "00" + n : (n < 100 ? "0" + n : "" + n); }

  // Get the parts of the current time in a given IANA tz, plus the millisecond
  // component of the user's local clock. The ms will drift slightly from
  // "true" local ms in that tz, but the sub-second precision is what the user
  // is buying. For a real production system you'd compute it from the
  // difference between Date.now() and the start of the second in the tz.
  function getTimeInTz(tz) {
    const d = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(d);
    const get = (t) => { const p = parts.find(x => x.type === t); return p ? p.value : ""; };
    let hour = parseInt(get("hour"), 10);
    if (hour === 24) hour = 0;  // some Intl impls return 24 for midnight
    const minute = parseInt(get("minute"), 10);
    const second = parseInt(get("second"), 10);
    const ms = d.getMilliseconds();
    // Get the UTC offset for the tz at this moment
    const offsetStr = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset"
    }).formatToParts(d).find(x => x.type === "timeZoneName");
    const offset = offsetStr ? offsetStr.value : "";
    return { hour, minute, second, ms, offset };
  }

  // ===========================================================================
  // Per-clock update functions
  // ===========================================================================

  // Sundial — rotate the shadow to match the clock time
  function updateSundial(card, t) {
    const shadow = card.querySelector(".sundial-shadow");
    if (!shadow) return;
    // 12h clock: 360° / 12h = 30°/h
    const angle = ((t.hour % 12) + t.minute / 60 + t.second / 3600) * 30 - 90;
    shadow.setAttribute("transform", `rotate(${angle.toFixed(2)} 100 100)`);
  }

  // Hourglass — nothing to update (the flip is CSS-driven every 30s)
  function updateHourglass(card, t) { /* ambient CSS animation handles it */ }

  // Pendulum — update hour & minute hands (pendulum bob is CSS-animated)
  function updatePendulum(card, t) {
    const hourHand = card.querySelector(".pend-hour");
    const minHand = card.querySelector(".pend-minute");
    if (hourHand) {
      const a = ((t.hour % 12) + t.minute / 60) * 30;
      hourHand.setAttribute("transform", `rotate(${a} 100 80)`);
    }
    if (minHand) {
      const a = (t.minute + t.second / 60) * 6;
      minHand.setAttribute("transform", `rotate(${a} 100 80)`);
    }
  }

  // Marine chronometer — three hands
  function updateChrono(card, t) {
    const hour = card.querySelector(".chrono-hour");
    const min = card.querySelector(".chrono-minute");
    const sec = card.querySelector(".chrono-second");
    if (hour) {
      const a = ((t.hour % 12) + t.minute / 60) * 30;
      hour.setAttribute("transform", `rotate(${a} 100 100)`);
    }
    if (min) {
      const a = (t.minute + t.second / 60) * 6;
      min.setAttribute("transform", `rotate(${a} 100 100)`);
    }
    if (sec) {
      // Smooth sweep: include the millisecond component
      const a = (t.second + t.ms / 1000) * 6;
      sec.setAttribute("transform", `rotate(${a} 100 100)`);
    }
  }

  // Water clock — ambient animation only (the dripping is CSS-driven).
  // We also slightly animate the lower water level based on the minute
  // so the bowl fills/drains in 60-second cycles, matching the "drop
  // counts the hour" mechanic of a real clepsydra.
  function updateWater(card, t) {
    const lower = card.querySelector(".water-lower");
    if (!lower) return;
    // 60s cycle: water level rises from y=170 to y=145 over 60s, then resets.
    const cycle = t.second; // 0..59
    const progress = cycle / 60; // 0..1
    const yStart = 170;
    const yEnd = 145;
    const y = yStart - (yStart - yEnd) * progress;
    // Build a path with the new y
    lower.setAttribute("d", `M 35 ${y.toFixed(1)} Q 35 175 100 178 Q 165 175 165 ${y.toFixed(1)} Z`);
  }

  // Quartz — digital HH:MM:SS, 1Hz step on the second (now uses the
  // gear-clock aesthetic with visible Roman numerals + sweeping hands)
  function updateQuartz(card, t) {
    const hour = card.querySelector(".chrono-hour");
    const min = card.querySelector(".chrono-minute");
    const sec = card.querySelector(".chrono-second");
    if (hour) {
      const a = ((t.hour % 12) + t.minute / 60) * 30;
      hour.setAttribute("transform", `rotate(${a} 100 100)`);
    }
    if (min) {
      const a = (t.minute + t.second / 60) * 6;
      min.setAttribute("transform", `rotate(${a} 100 100)`);
    }
    if (sec) {
      const a = (t.second + t.ms / 1000) * 6;
      sec.setAttribute("transform", `rotate(${a} 100 100)`);
    }
  }

  // Atomic — digital HH:MM:SS.mmm with sub-second precision
  function updateAtomic(card, t) {
    const txt = card.querySelector(".atomic-time");
    if (txt) {
      txt.textContent = pad2(t.hour) + ":" + pad2(t.minute) + ":" + pad2(t.second) + "." + pad3(t.ms);
    }
    // Pulse the indicator dot
    const pulse = card.querySelector(".atomic-pulse");
    if (pulse) {
      const scale = 0.7 + Math.abs(Math.sin(t.ms / 1000 * Math.PI)) * 0.6;
      pulse.setAttribute("r", scale.toFixed(2));
    }
  }

  const UPDATERS = {
    sundial: updateSundial,
    hourglass: updateHourglass,
    pendulum: updatePendulum,
    chrono: updateChrono,
    water: updateWater,
    quartz: updateQuartz,
    atomic: updateAtomic
  };

  // ===========================================================================
  // Clock intro metadata (from the Timeline of Time Keepers)
  // year: human-readable, e.g. "~3500 BC", "1656", "1955"
  // inventor: who built the first one
  // power: what makes it tick
  // news: link to the relevant news article
  // ===========================================================================
  const CLOCK_INTRO = {
    sundial:   { year: "~3500 BC", inventor: "Ancient Egyptians",   power: "Sunlight",            news: "/news/2026/07/history-of-timekeeping/" },
    hourglass: { year: "150 BC",   inventor: "Ancient Romans",      power: "Sand & gravity",      news: "/news/2026/07/history-of-timekeeping/" },
    pendulum:  { year: "1656",     inventor: "Christiaan Huygens",  power: "Gravity",             news: "/news/2026/07/pendulum-clock-huygens/" },
    chrono:    { year: "1735",     inventor: "John Harrison",       power: "Spring + balance",    news: "/news/2026/07/marine-chronometer-harrison/" },
    water:     { year: "16th C. BC", inventor: "Babylonians & Egyptians", power: "Regulated water flow", news: "/news/2026/07/history-of-timekeeping/" },
    quartz:    { year: "1927",     inventor: "Warren Marrison",     power: "Quartz crystal",      news: "/news/2026/07/quartz-revolution-seiko/" },
    atomic:    { year: "1955",     inventor: "Louis Essen (NPL UK)",power: "Cesium-133 atom",     news: "/news/2026/07/atomic-clock-nist/" }
  };

  // ===========================================================================
  // Render the section
  // ===========================================================================

  function buildHeroClocksSection(cities) {
    // cities: [{ name, slug, country, tz, clock, isUser? }, ...]
    const cards = cities.map(c => {
      const renderer = SVG_RENDERERS[c.clock];
      const svg = renderer ? renderer() : "";
      const path = c.country
        ? `/world-time/${c.country.toLowerCase().replace(/\s+/g, "-")}/${c.slug}/`
        : `/world-time/${c.slug}/`;
      const intro = CLOCK_INTRO[c.clock] || {};
      // The "Read the story" link goes BELOW the card (so the whole card
      // is the city page, and the small link is to the history article).
      // We close the </a> early so the link isn't inside the city link.
      return `<div class="wt-clock-wrap">
        <a class="wt-clock wt-clock-${c.clock}" href="${path}" data-tz="${c.tz}" aria-label="Live clock for ${c.name}">
          <div class="wt-clock-face">${svg}</div>
          <div class="wt-clock-info">
            <div class="wt-clock-name">${c.name}${c.isUser ? ' <span class="wt-clock-you">You</span>' : ""}</div>
            <div class="wt-clock-tz">${c.tz}</div>
            <div class="wt-clock-time" data-clock-ms>
              <span class="wt-clock-hms" data-hms>--:--:--</span><span class="wt-clock-ms-sep" data-ms-sep>.</span><span class="wt-clock-ms" data-ms>---</span>
            </div>
            <div class="wt-clock-offset" data-offset>UTC</div>
          </div>
        </a>
        <div class="wt-clock-intro">
          <span class="wt-clock-year">${intro.year || ""}</span>
          <span class="wt-clock-dot" aria-hidden="true">·</span>
          <span class="wt-clock-inventor">${intro.inventor || ""}</span>
        </div>
        <div class="wt-clock-power">Powered by ${intro.power || ""}</div>
        ${intro.news ? `<a class="wt-clock-story" href="${intro.news}">Read the story →</a>` : ""}
      </div>`;
    }).join("");

    return `<section class="wt-hub-section wt-hero-clocks-section" id="hero-clocks">
      <div class="container">
        <div class="wt-hub-header">
          <h2>Six cities, six timekeepers</h2>
          <span class="wt-hub-sub">From a <strong>~3500 BC</strong> sundial to a <strong>1955</strong> atomic clock — live, in real time. Each clock face shows the actual local time in its city, with millisecond precision.</span>
        </div>
        <div class="wt-clock-grid">
          ${cards}
        </div>
      </div>
    </section>`;
  }

  // ===========================================================================
  // Mount: insert into the page, start the rAF loop
  // ===========================================================================

  function mountHeroClocks(cities, hostSelector) {
    const host = document.querySelector(hostSelector);
    if (!host) return;
    host.insertAdjacentHTML("afterend", buildHeroClocksSection(cities));
    const cards = host.parentElement.querySelectorAll(".wt-clock");
    if (!cards.length) return;

    // One rAF loop for all clocks. Per-clock ms-precise updates run at the
    // browser's refresh rate (typically 60Hz on desktops, 120Hz on some
    // mobile devices). Sundial + chrono second hand will look buttery-smooth.
    function tick() {
      const d = new Date();
      cards.forEach(card => {
        const tz = card.getAttribute("data-tz");
        const clock = (card.className.match(/wt-clock-(\w+)/) || [])[1];
        if (!tz || !clock) return;
        const t = getTimeInTz(tz);

        // Update the clock face (hands, shadow, display)
        const updater = UPDATERS[clock];
        if (updater) updater(card, t);

        // Update the textual readout below the clock
        const hms = card.querySelector("[data-hms]");
        const ms = card.querySelector("[data-ms]");
        const off = card.querySelector("[data-offset]");
        if (hms) hms.textContent = pad2(t.hour) + ":" + pad2(t.minute) + ":" + pad2(t.second);
        if (ms) ms.textContent = pad3(t.ms);
        if (off) off.textContent = t.offset;
      });
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // Expose to the page
  window.MountHeroClocks = mountHeroClocks;
})();

/* Data Viz Lab — shared helpers. Plain script; exposes window.Lab.
   Load after d3:  <script src="../assets/vendor/d3-7.9.0.min.js"></script>
                   <script src="../assets/js/lab.js"></script>              */
(function () {
  "use strict";
  const Lab = {};

  /* ---------- theme ---------- */
  const THEME_KEY = "dvl-theme";
  function storedTheme() { try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; } }
  function applyTheme(t) {
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }
  applyTheme(storedTheme());

  const themeListeners = [];
  /** Call fn whenever the effective theme changes (canvas charts need this; SVG using var() does not). */
  Lab.onTheme = function (fn) { themeListeners.push(fn); };
  function fireTheme() { themeListeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    (mq.addEventListener ? mq.addEventListener("change", fireTheme) : mq.addListener(fireTheme));
  }

  function wireToggle() {
    const btn = document.querySelector(".theme-toggle");
    if (!btn) return;
    const order = ["auto", "light", "dark"];
    const label = (t) => ({ auto: "Theme: auto", light: "Theme: light", dark: "Theme: dark" }[t]);
    let cur = storedTheme() || "auto";
    btn.textContent = label(cur);
    btn.addEventListener("click", () => {
      cur = order[(order.indexOf(cur) + 1) % order.length];
      try { cur === "auto" ? localStorage.removeItem(THEME_KEY) : localStorage.setItem(THEME_KEY, cur); } catch (e) {}
      applyTheme(cur);
      btn.textContent = label(cur);
      fireTheme();
    });
  }

  /** Current value of a CSS custom property, e.g. Lab.css("--series-1"). */
  Lab.css = function (name, el) {
    return getComputedStyle(el || document.documentElement).getPropertyValue(name).trim();
  };
  Lab.series = function (i) { return Lab.css("--series-" + ((i % 8) + 1)); };
  Lab.isDark = function () {
    const t = document.documentElement.getAttribute("data-theme");
    if (t) return t === "dark";
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  };
  Lab.reducedMotion = function () {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  };

  /* ---------- seeded randomness (so synthetic data is reproducible) ---------- */
  /** mulberry32: Lab.rng(42)() -> [0,1) */
  Lab.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  /** Standard normal from a uniform source (Box–Muller). */
  Lab.randn = function (rand) {
    let u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  /** Random walk of length n with drift and volatility. */
  Lab.walk = function (rand, n, start, drift, vol) {
    const out = [start];
    for (let i = 1; i < n; i++) out.push(out[i - 1] * (1 + drift + vol * Lab.randn(rand)));
    return out;
  };

  /* ---------- tooltip ---------- */
  let tipEl = null;
  function tip() {
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.className = "lab-tooltip";
      tipEl.setAttribute("role", "status");
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }
  /** Lab.tooltip.show(event, html) / Lab.tooltip.hide() — positions near the pointer, flips at edges. */
  Lab.tooltip = {
    show(event, html) {
      const el = tip();
      el.innerHTML = html;
      el.classList.add("on");
      const pad = 14, r = el.getBoundingClientRect();
      let x = event.clientX + pad, y = event.clientY + pad;
      if (x + r.width > window.innerWidth - 8) x = event.clientX - r.width - pad;
      if (y + r.height > window.innerHeight - 8) y = event.clientY - r.height - pad;
      el.style.left = Math.max(8, x) + "px";
      el.style.top = Math.max(8, y) + "px";
    },
    hide() { if (tipEl) tipEl.classList.remove("on"); },
  };

  /* ---------- table view ---------- */
  /**
   * Append a collapsible data table (the accessible twin of a chart).
   * columns: [{key, label, align:'r'|'l', format: fn}]
   */
  Lab.tableView = function (container, columns, rows, summary) {
    const host = typeof container === "string" ? document.querySelector(container) : container;
    const d = document.createElement("details");
    d.className = "table-view";
    const s = document.createElement("summary");
    s.textContent = summary || "Show the data as a table";
    d.appendChild(s);
    const wrap = document.createElement("div");
    wrap.className = "tv-scroll";
    const t = document.createElement("table");
    t.className = "lab";
    const thead = t.createTHead().insertRow();
    columns.forEach((c) => {
      const th = document.createElement("th");
      th.textContent = c.label;
      if (c.align === "r") th.className = "r";
      thead.appendChild(th);
    });
    const tb = t.createTBody();
    rows.forEach((row) => {
      const tr = tb.insertRow();
      columns.forEach((c) => {
        const td = tr.insertCell();
        const v = row[c.key];
        td.textContent = c.format ? c.format(v, row) : v;
        if (c.align === "r") td.className = "r";
      });
    });
    wrap.appendChild(t);
    d.appendChild(wrap);
    host.appendChild(d);
    return d;
  };

  /* ---------- sizing ---------- */
  /** Width available inside an element (content box). */
  Lab.width = function (el) {
    const node = typeof el === "string" ? document.querySelector(el) : el;
    const cs = getComputedStyle(node);
    return node.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  };
  /** Re-run fn on resize (debounced), and once now. */
  Lab.responsive = function (fn) {
    let w = window.innerWidth, timer;
    fn();
    window.addEventListener("resize", () => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (window.innerWidth !== w) { w = window.innerWidth; fn(); } }, 150);
    });
  };

  /** HiDPI canvas: returns 2D context scaled to devicePixelRatio. */
  Lab.canvas = function (canvas, width, height) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  };

  Lab.fmt = {
    int: (v) => d3.format(",.0f")(v),
    pct: (v) => d3.format(".0%")(v),
    pct1: (v) => d3.format(".1%")(v),
    usd: (v) => d3.format("$,.0f")(v),
    usdK: (v) => d3.format("$,.0s")(v).replace("G", "B"),
    one: (v) => d3.format(",.1f")(v),
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wireToggle);
  else wireToggle();

  window.Lab = Lab;
})();

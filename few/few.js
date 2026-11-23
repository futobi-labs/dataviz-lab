/* Stephen Few section: shared data and marks.
   Load after d3 and lab.js. Exposes window.Few.
   Everything is drawn with CSS custom properties so light/dark switches without a redraw. */
(function () {
  "use strict";
  const Few = {};

  const pct0 = d3.format(".0%"), pct1 = d3.format(".1%"), int = d3.format(",.0f");

  /**
   * The six KPIs used across the section. ranges are the upper bounds of the
   * qualitative bands (poor, satisfactory, good); the last bound is the scale max.
   * Values and monthly histories come from Lab.rng(42), so every reload is identical.
   */
  Few.kpis = function () {
    const rand = Lab.rng(42);
    const defs = [
      { id: "rev", name: "Revenue", short: "Revenue", units: "YTD, US$ thousands", unitsShort: "$K, YTD",
        target: 2900, ranges: [2100, 2600, 3300], dev: [-0.07, 0.02], vol: 0.03,
        fmt: (v) => "$" + int(v) + "K", tick: int },
      { id: "margin", name: "Profit margin", short: "Margin", units: "% of revenue", unitsShort: "% of rev.",
        target: 0.24, ranges: [0.18, 0.22, 0.30], dev: [-0.30, -0.26], vol: 0.025,
        fmt: pct1, tick: pct0 },
      { id: "cust", name: "New customers", short: "Customers", units: "count, YTD", unitsShort: "count",
        target: 1050, ranges: [700, 950, 1400], dev: [0.06, 0.16], vol: 0.035,
        fmt: int, tick: int },
      { id: "order", name: "Avg order size", short: "Order size", units: "US$ per order", unitsShort: "US$",
        target: 340, ranges: [240, 310, 420], dev: [-0.05, 0.03], vol: 0.02,
        fmt: d3.format("$,.0f"), tick: d3.format("$,.0f") },
      { id: "csat", name: "Satisfaction", short: "Satisfaction", units: "% rating 4 or 5", unitsShort: "% 4 or 5",
        target: 0.85, ranges: [0.70, 0.80, 1.0], dev: [-0.03, 0.02], vol: 0.01,
        fmt: pct0, tick: pct0 },
      { id: "ontime", name: "On-time delivery", short: "On-time", units: "% of orders", unitsShort: "% orders",
        target: 0.95, ranges: [0.88, 0.93, 1.0], dev: [-0.04, -0.02], vol: 0.006,
        fmt: pct1, tick: pct0 },
    ];
    return defs.map((k) => {
      const max = k.ranges[k.ranges.length - 1];
      const dev = k.dev[0] + (k.dev[1] - k.dev[0]) * rand();
      const value = Math.min(max * 0.995, k.target * (1 + dev));
      // 12 monthly observations of the same measure, ending near the current value.
      const raw = Lab.walk(rand, 12, 1, 0.003, k.vol);
      const monthly = raw.map((r) => (r / raw[11]) * value);
      return Object.assign({}, k, { value, max, monthly, band: Few.band(k, value) });
    });
  };

  /** Qualitative band name for a value. */
  Few.band = function (k, v) {
    if (v < k.ranges[0]) return "Poor";
    if (v < k.ranges[1]) return "Satisfactory";
    return "Good";
  };

  Few.bandFills = ["var(--band-1)", "var(--band-2)", "var(--band-3)"];

  /** Tooltip body for a KPI. */
  Few.kpiTip = function (k) {
    const r = k.ranges;
    return `<strong>${k.name}</strong> <span class="tt-k">${k.units}</span><br>` +
      `<span class="tt-k">Actual</span> ${k.fmt(k.value)}<br>` +
      `<span class="tt-k">Target</span> ${k.fmt(k.target)} (${pct0(k.value / k.target)} of target)<br>` +
      `<span class="tt-k">Band</span> ${k.band}: poor under ${k.fmt(r[0])}, good from ${k.fmt(r[1])}`;
  };

  /**
   * Horizontal bullet graph per Few's specification, drawn into g with its origin at the
   * left end of the scale. o: {width, bandH, axis (bool), ticks}. Returns the x scale.
   */
  Few.bulletH = function (g, k, o) {
    const bh = o.bandH || 24;
    const x = d3.scaleLinear([0, k.max], [0, o.width]);
    let prev = 0;
    k.ranges.forEach((r, i) => {
      g.append("rect").attr("x", x(prev)).attr("y", 0).attr("width", Math.max(0, x(r) - x(prev))).attr("height", bh)
        .style("fill", Few.bandFills[i]);
      prev = r;
    });
    // featured measure: one third of the band height, centered
    g.append("rect").attr("x", 0).attr("y", bh / 3).attr("width", x(k.value)).attr("height", bh / 3)
      .style("fill", "var(--text-primary)");
    // comparative measure: perpendicular tick, about 70% of band height
    const tw = bh >= 20 ? 3 : 2;
    g.append("rect").attr("x", x(k.target) - tw / 2).attr("y", bh * 0.15).attr("width", tw).attr("height", bh * 0.7)
      .style("fill", "var(--text-primary)");
    if (o.axis !== false) {
      g.append("g").attr("class", "axis").attr("transform", `translate(0,${bh})`)
        .call(d3.axisBottom(x).ticks(o.ticks || 5).tickFormat(k.tick).tickSize(4).tickSizeOuter(0))
        .call((a) => a.select(".domain").remove());
    }
    return x;
  };

  /** Vertical bullet graph; origin at the top-left of the band, height h. Axis on the left. */
  Few.bulletV = function (g, k, o) {
    const bw = o.bandW || 24, h = o.height;
    const y = d3.scaleLinear([0, k.max], [h, 0]);
    let prev = 0;
    k.ranges.forEach((r, i) => {
      g.append("rect").attr("x", 0).attr("y", y(r)).attr("width", bw).attr("height", Math.max(0, y(prev) - y(r)))
        .style("fill", Few.bandFills[i]);
      prev = r;
    });
    g.append("rect").attr("x", bw / 3).attr("y", y(k.value)).attr("width", bw / 3).attr("height", h - y(k.value))
      .style("fill", "var(--text-primary)");
    g.append("rect").attr("x", bw * 0.15).attr("y", y(k.target) - 1.5).attr("width", bw * 0.7).attr("height", 3)
      .style("fill", "var(--text-primary)");
    g.append("g").attr("class", "axis")
      .call(d3.axisLeft(y).ticks(o.ticks || 5).tickFormat(k.tick).tickSize(4).tickSizeOuter(0))
      .call((a) => a.select(".domain").remove());
    return y;
  };

  /** Sparkline: thin line, a dot on the last value. Returns {x, y}. */
  Few.spark = function (g, values, w, h, o) {
    o = o || {};
    const pad = 3;
    const x = d3.scaleLinear([0, values.length - 1], [pad, w - pad]);
    const ext = d3.extent(values), span = (ext[1] - ext[0]) || 1;
    const y = d3.scaleLinear([ext[0] - span * 0.08, ext[1] + span * 0.08], [h - pad, pad]);
    g.append("path").attr("d", d3.line((d, i) => x(i), y)(values))
      .style("fill", "none").style("stroke", o.stroke || "var(--text-secondary)").style("stroke-width", 1.25)
      .style("stroke-linejoin", "round");
    const n = values.length - 1;
    g.append("circle").attr("cx", x(n)).attr("cy", y(values[n])).attr("r", 2.2).style("fill", "var(--text-primary)");
    return { x, y };
  };

  /** Wire a hover tooltip to a selection; html(d, event) returns the body. */
  Few.hover = function (sel, html) {
    sel.style("cursor", "default")
      .on("pointerenter pointermove", function (event, d) { Lab.tooltip.show(event, html(d, event, this)); })
      .on("pointerleave", () => Lab.tooltip.hide());
  };

  window.Few = Few;
})();

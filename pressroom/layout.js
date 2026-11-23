/* Pressroom: the bento layout as data, shared by the report page and the
   Power BI notes (and mirrored by tools/pressroom_canvas.py, which bakes the
   background image). A 1280 x 720 Power BI page, 12 columns by 6 rows.
   Exposes window.PR. Load after lab.js. */
(function () {
  "use strict";
  const PR = {};
  PR.page = { w: 1280, h: 720, pad: 16, gap: 12, cols: 12, rows: 6 };

  /* n, key, block color, grid area [col, row, colSpan, rowSpan] (1-based) */
  PR.tiles = [
    { n: 1, key: "a", block: "stone",     area: [1, 1, 4, 2], name: "Title and month slicer" },
    { n: 2, key: "b", block: "harbor",    area: [5, 1, 3, 2], name: "Nights on time" },
    { n: 3, key: "c", block: "marigold",  area: [8, 1, 5, 3], name: "Pegboard: every night" },
    { n: 4, key: "d", block: "persimmon", area: [1, 3, 7, 1], name: "Tape measure: Gold finish" },
    { n: 5, key: "e", block: "paper",     area: [1, 4, 5, 3], name: "Bronze landing time by month" },
    { n: 6, key: "f", block: "moss",      area: [6, 4, 3, 3], name: "Halftone: test warnings and failures" },
    { n: 7, key: "g", block: "paper",     area: [9, 4, 4, 2], name: "Bronze minutes by source" },
    { n: 8, key: "h", block: "patina",    area: [9, 6, 4, 1], name: "Incidents" },
  ];

  /* Pixel rectangle of a tile on the 1280 x 720 page (what you type into Power BI's
     Format > General > Properties > Size and position). */
  PR.rect = function (t) {
    const p = PR.page;
    const cw = (p.w - 2 * p.pad - (p.cols - 1) * p.gap) / p.cols;
    const rh = (p.h - 2 * p.pad - (p.rows - 1) * p.gap) / p.rows;
    const [c, r, cs, rs] = t.area;
    return {
      x: Math.round(p.pad + (c - 1) * (cw + p.gap)),
      y: Math.round(p.pad + (r - 1) * (rh + p.gap)),
      w: Math.round(cs * cw + (cs - 1) * p.gap),
      h: Math.round(rs * rh + (rs - 1) * p.gap),
    };
  };

  window.PR = PR;
})();

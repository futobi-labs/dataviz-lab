# Data Viz Lab: notes for Claude

Static GitHub Pages site. No build, no bundler, no framework. Pushing to `main` publishes
(Pages deploys the branch root; `.nojekyll` disables Jekyll). Live: https://labs.tannerspaulding.com/dataviz-lab/

## Layout
- `index.html`: home. The featured room is `engineer/`; the four studies follow as cards with live thumbnails.
- `engineer/`: "The engineer's eye", the signature section. Its `index.html` is the Test Print way in (facts baked from warehouse.js at build time); the five views keep lab.css. Every page loads `engineer/warehouse.js` (`window.WH`): one synthetic medallion warehouse (42 tables, 6 sources), a simulated year of nightly loads (`WH.runs()`), data-quality results (`WH.dq()`), column lineage (`WH.columnEdges`) and schema events. Never generate separate data on these pages; extend `warehouse.js` instead. If real, scrubbed metadata arrives, load it into the same shapes.
- `pressroom/`: "Pressroom", a tactile palette and texture system (`pressroom.css`, all tokens scoped under `.pr`; the system page is `system.html`, and `index.html` is the Test Print way in) and a bento report page (`report.html`) on the `engineer/warehouse.js` data, built to translate to Power BI. `layout.js` (`window.PR`) holds the 1280x720 12x6 tile layout. Power BI themes `pressroom-light.json` / `pressroom-dark.json` come from `tools/pressroom_theme.py`; textured canvas backgrounds `canvas-*.jpg` from `tools/pressroom_canvas.py` (keep its TILES in step with layout.js). Pressroom pages use `--pr-*` tokens, not the lab's `--series-*`; on a colored block, marks and text wear that block's `--on` color only.
- `experimental/`, `few/`, `tufte/`, `new/`: each has an `index.html` (the study shelf, in the Futobi Labs Test Print frame: a live window and Go in buttons that open each piece in a room) plus one HTML file per piece. The pieces keep their own lab.css style; only the shelf page, the way in, is Test Print.
- `assets/css/lab.css`: all design tokens and shared classes. Light/dark via `prefers-color-scheme` plus `[data-theme]` set by the header toggle.
- `assets/js/lab.js`: `window.Lab` helpers (seeded RNG `Lab.rng`, `Lab.randn`, `Lab.walk`, `Lab.tooltip`, `Lab.tableView`, `Lab.responsive`, `Lab.canvas`, `Lab.css`, `Lab.onTheme`, `Lab.fmt`).
- `assets/vendor/d3-7.9.0.min.js`: D3, vendored so pages never depend on a CDN.

## Adding a page
1. Copy an existing page in the section as the skeleton (head includes lab.css, d3, lab.js; header nav with `aria-current="true"` on the section; `.kicker`, `h1`, `.lede`, `.figure`, `.notes`, `.source`, footer).
2. Add a card for it in that section's `index.html` and bump the count on the home page card.
3. Tufte pages use `<body class="tufte">` for the serif book face.

## Visual rules (keep them)
- Colors only via tokens. SVG: `.style("fill", "var(--series-1)")` so theme switches need no redraw. Canvas: read with `Lab.css()` and redraw in `Lab.onTheme`.
- Categorical slots `--series-1..8` in fixed order, never cycled or generated; at most 3 colors in scatter or other all-pairs views (the palette is validated for CVD only adjacent-pairs beyond that).
- Status colors (`--good/--warning/--serious/--critical`) mean status only, always with a label or icon.
- Never a dual-axis chart. Sequential = one hue; diverging = two poles plus neutral mid.
- Thin marks, solid hairline grids, selective direct labels, hover tooltips, a `Lab.tableView` twin where values matter.
- Seeded synthetic data; state the source on the page in `.source`.
- Responsive 360 to 1400px with no horizontal scroll; honor `Lab.reducedMotion()` with a pause control on continuous animation.
- Prose is for an expert reader: short, opinionated, no em-dashes.

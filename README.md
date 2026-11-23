# Data Viz Lab

An exploratory data visualization notebook, published at
**https://tannerspaulding.github.io/dataviz-lab/**.

Four rooms:

| Section | Folder | What lives there |
|---|---|---|
| Experimental | `experimental/` | Generative, physical, odd D3. Data art that still encodes data. |
| Stephen Few | `few/` | Bullet graphs, one-screen dashboards, table-or-graph decisions. |
| Edward Tufte | `tufte/` | Sparklines, slopegraphs, range-frames, small multiples. |
| New data viz | `new/` | Scrollytelling, uncertainty (HOPs, quantile dotplots), linked views. |

Plain HTML, CSS and D3 v7.9.0 (vendored in `assets/vendor/`). No build step.
Every push to `main` publishes through GitHub Pages (branch deploy from the repo root;
`.nojekyll` makes Pages serve files as-is).

Data is synthetic and seeded unless a page says otherwise, so every reload draws the same picture.

## Run locally

```
python3 -m http.server 8000
```

then open http://localhost:8000/.

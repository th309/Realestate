# Site Redesign Mockups — 2026-08-02

Static HTML mockups that govern the site redesign. These are the **source of truth for the
visual spec** — the real spacing, type scale, and color values live in each file's CSS.
Read the file (or its published artifact) before implementing the matching page; do not
improvise the UI.

Build tasks reference these per-task in
[`../../plans/2026-08-03-propertyiq-site-redesign.md`](../../plans/2026-08-03-propertyiq-site-redesign.md).

| Mockup file                                            | Surface           | Published artifact                                                   |
| ------------------------------------------------------ | ----------------- | -------------------------------------------------------------------- |
| [`piq-homepage-mockup.html`](piq-homepage-mockup.html) | Homepage + blog   | https://claude.ai/code/artifact/99e2d97d-df27-4d55-9f7b-83da181b3697 |
| [`piq-analyzer-mockup.html`](piq-analyzer-mockup.html) | Deal Analyzer     | https://claude.ai/code/artifact/3218c833-210f-4bc8-8e68-6351ea9533ca |
| [`piq-reports-mockup.html`](piq-reports-mockup.html)   | Reports           | https://claude.ai/code/artifact/bd22f957-f9c9-4d8d-b1f0-a7abef9b220d |
| [`piq-screener-mockup.html`](piq-screener-mockup.html) | Market Screener   | https://claude.ai/code/artifact/f4d5ad0d-84ea-43ed-be9f-c9bb743a28e0 |
| [`piq-market-mockup.html`](piq-market-mockup.html)     | Market Explorer   | https://claude.ai/code/artifact/bf98674e-7cff-4a49-9253-5369e78dbf7a |
| [`piq-map-mockup.html`](piq-map-mockup.html)           | Map (chrome only) | https://claude.ai/code/artifact/c2a2557f-0576-4a24-a720-20d0e0032f78 |

[`SHARED-DESIGN-SPEC.md`](SHARED-DESIGN-SPEC.md) holds the tokens all six mockups share —
read it first, then the individual mockup for page-specific detail.

**Map caveat:** the map mockup covers **chrome only** (panels, controls, legend). The Mapbox
canvas itself is out of scope and stays as-is.

Copied from the authoring scratchpad on 2026-08-04 so they survive temp-directory cleanup.
The map mockup was last revised 2026-08-03; the rest 2026-08-02.

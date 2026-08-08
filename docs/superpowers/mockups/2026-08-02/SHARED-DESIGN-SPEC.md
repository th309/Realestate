# PropertyIQ mockup — shared design spec

All mockups must look like they came from one system. Copy this exactly.

## Hard rules

1. **No emoji anywhere.** Icons are inline Lucide SVG only, defined once as a `<symbol>` sprite and used via `<use href="#i-x"/>`. `stroke-width:2`, round caps, `fill:none`, `viewBox="0 0 24 24"`.
2. **Every number is monospace + tabular**, one format per quantity type. Use a true minus sign `−`, not a hyphen. `.n{font-family:var(--mono);font-variant-numeric:tabular-nums;letter-spacing:-.02em}`
3. **Never invent data.** Use the real values you observe on the live page. If a value isn't visible, omit it rather than making one up. Never invent testimonials, user counts, or metrics.
4. **Keep every existing feature and all content.** This is a restyle: layout and visual language only. Nothing gets removed or replaced with something "simpler".
5. Self-contained HTML: no external fonts, scripts, images, or CSS. No `<!DOCTYPE>`, `<html>`, `<head>`, `<body>` tags — start with `<title>` then `<style>`.
6. Light **and** dark themes via the token block below, including `:root[data-theme="dark"]` and `:root[data-theme="light"]` overrides.
7. Wide content (tables) goes in `overflow-x:auto`. The page body must never scroll sideways.

## Tokens — paste verbatim

```css
:root {
  --canvas: #f5f6fa;
  --white: #ffffff;
  --line: #e4e7f2;
  --soft: #edeff7;
  --ink: #12141d;
  --body: #5b6076;
  --muted: #8b91a8;
  --indigo: #3949ab;
  --indigo-soft: #eef0fb;
  --green: #00a84a;
  --green-b: #00c853;
  --green-soft: #e6f8ee;
  --red: #b3261e;
  --red-soft: #fdecea;
  --amber: #e07b00;
  --amber-soft: #fff3e0;
  --violet: #7c4dff;
  --violet-soft: #f1ecff;
  --teal: #00838f;
  --teal-soft: #e0f7fa;
  --bar: #151828;
  --bar-mute: #9aa1ba;
  --bar-line: #272c40;
  --sh: 0 1px 2px rgba(18, 20, 29, 0.05), 0 2px 8px rgba(18, 20, 29, 0.04);
  --sans:
    "Segoe UI Variable Display", -apple-system, BlinkMacSystemFont, "Segoe UI",
    Roboto, Helvetica, Arial, sans-serif;
  --mono:
    "Roboto Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --canvas: #0f1119;
    --white: #1a1d29;
    --line: #2a2f42;
    --soft: #232838;
    --ink: #edeff7;
    --body: #a5abc2;
    --muted: #797f96;
    --indigo: #8c9ae8;
    --indigo-soft: #232841;
    --green: #3dd87a;
    --green-soft: #17301f;
    --red: #f2b8b5;
    --red-soft: #33201f;
    --amber: #ffb74d;
    --amber-soft: #33280f;
    --violet: #b39dff;
    --violet-soft: #241f38;
    --teal: #4dd0e1;
    --teal-soft: #13292e;
    --bar: #0a0c14;
    --bar-line: #1e2333;
    --sh: 0 1px 2px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3);
  }
}
```

Duplicate the dark block under `:root[data-theme="dark"]` and the light block under `:root[data-theme="light"]`.

## Chrome — identical on every mockup

Dark sticky app bar, 56–58px tall, `background:var(--bar)`:

- Left: logo — 28px `border-radius:8px` indigo square with `P`, then `Property` + `IQ` in `#8C9AE8`
- Nav pills: Dashboard · Map · Analyzer · Screener · Reports. Each is an 18px coloured rounded tile + label. Active pill = `background:var(--indigo)`, tile becomes `rgba(255,255,255,.25)`. Tile colours: Dashboard `#3949AB`, Map `#00838F`, Analyzer `#3949AB`, Screener `#7C4DFF`, Reports `#00C853`. Mark the current page active.
- Right: `Pro` chip on `rgba(255,255,255,.1)`, then bell and user icon buttons.
- Hide nav labels under 1150px via `.lb{display:none}`.

Below it, **one** light control bar (`background:var(--white)`, `border-bottom:1px solid var(--line)`, ~11px 20px padding) holding search / filters / view toggles. Never stack multiple chrome rows.

## Patterns

- **Card**: `background:var(--white); border:1px solid var(--line); border-radius:14px; box-shadow:var(--sh)`
- **Card header**: 14px 16px, `border-bottom:1px solid var(--line)`, 25px coloured icon tile + 14px bold title + optional right-aligned `.lab`
- **`.lab` micro-label**: `font-size:9.5px; font-weight:700; letter-spacing:.11em; text-transform:uppercase; color:var(--muted)`
- **KPI tile**: `border-left:3px solid <accent>`, `.lab` on top, 24px mono value, 11px grey caption saying what the metric _is_
- **Chip / pill**: `border-radius:999px`, 1px border, 12.5px 600 weight, optional 20–24px coloured icon tile on the left
- **Segmented control**: `background:var(--canvas)`, 3px padding, `border-radius:10px`; active = white pill with `box-shadow:var(--sh)` and indigo text
- **Table**: 12.5px, right-aligned mono cells, left-aligned sans first column, `th` uses `.lab` styling, rows `border-bottom:1px solid var(--soft)`, totals row on `var(--canvas)`
- **AI narrative block**: `background:var(--indigo-soft)`, italic, with a lightbulb icon
- **Buttons**: primary `background:var(--indigo); color:#fff; border-radius:10px`; secondary white with `1px solid var(--line)`
- Two-up rows where content allows: `display:grid; grid-template-columns:1fr 1fr; gap:16px` above 1240px, single column below.

## Ending section

Finish with a `<section class="notes">` — an `<h2>` plus an ordered list of what changed and why, each item citing the specific problem observed on the live page. Be concrete, no filler.

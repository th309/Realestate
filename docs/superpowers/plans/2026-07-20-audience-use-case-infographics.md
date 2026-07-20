# Audience Use-Case Infographics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce 3 on-brand PNG infographics (Investor, Homebuyer, Agents) depicting real, dated PropertyIQ product output — no fabricated data, screens, or quotes.

**Architecture:** Static HTML/CSS files (one shared stylesheet + one file per infographic) rendered at a fixed 2000×1125px viewport via Playwright and screenshotted to PNG. No React/Next involvement — these are one-off static assets, not app routes.

**Tech Stack:** Plain HTML/CSS (Google Fonts Roboto + Roboto Mono via CDN), Playwright MCP tools for headless rendering, Node one-liners for PNG dimension verification.

## Global Constraints

- Every number, quote, and screen depicted MUST trace to: `packages/frontend/app/components/home/landing-v2/persona/snapshots.ts` (Austin, TX · ZIP 78704, captured 2026-05-31), the live MCP `compare_markets_for_content` pull made 2026-06-30 (Seattle metro 42660 vs. Buffalo metro 15380), `app/components/home/UseCasesSection.tsx`, or `COVERAGE_COPY` in `packages/frontend/lib/data/validation-claims.ts`. No invented screens, numbers, or quotes.
- Every stat panel carries an "as of [date]" attribution line.
- Canvas is exactly 2000×1125px for all 3 infographics — verify with the Node dimension check in each task.
- Brand tokens only: primary `#3949AB`, primary dark `#1A237E`, primary medium `#5C6BC0`, primary light `#C5CAE9`, primary container `#E8EAF6`, accent `#00C853`, error `#B3261E`, warning `#FF8F00`, surface `#FAFBFF`. Roboto for UI text, Roboto Mono for numeric values. No off-brand hex values anywhere.
- Broker is merged into the Agents infographic with no separate naming or dedicated panel (per amended spec).
- Source files: `docs/superpowers/specs/assets/2026-07-20-audience-use-case-infographics/{slug}.html` + shared `_shared.css` in the same folder. Output: `packages/frontend/public/images/infographics/{slug}.png`.
- Spec reference: `docs/superpowers/specs/2026-07-20-audience-use-case-infographics-design.md`.

---

### Task 1: Shared brand stylesheet + smoke test

**Files:**

- Create: `docs/superpowers/specs/assets/2026-07-20-audience-use-case-infographics/_shared.css`
- Create: `docs/superpowers/specs/assets/2026-07-20-audience-use-case-infographics/_smoke-test.html`
- Output (temporary, deleted at end of task): `packages/frontend/public/images/infographics/_smoke-test.png`

**Interfaces:**

- Produces: CSS classes consumed by Tasks 2-4 — `.header`, `.eyebrow`, `.title`, `.hook`, `.score-strip`, `.end-label`, `.scale-bar`, `.mid-caption`, `.panels`, `.card`, `.card-header`, `.as-of`, `.stat-rows`, `.stat-row`, `.label`, `.value` (+ `.pos`/`.neg`/`.warn` modifiers on `.value` and `.verdict`), `.verdict`, `.footer`, `.wordmark`, `.coverage`, `.stat-tile`, `.num`, `.cap`, `.mono`.

- [ ] **Step 1: Create the shared stylesheet**

```css
/* docs/superpowers/specs/assets/2026-07-20-audience-use-case-infographics/_shared.css */
@import url("https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&family=Roboto+Mono:wght@400;500&display=swap");

:root {
  --primary: #3949ab;
  --primary-dark: #1a237e;
  --primary-medium: #5c6bc0;
  --primary-light: #c5cae9;
  --primary-container: #e8eaf6;
  --accent: #00c853;
  --error: #b3261e;
  --warning: #ff8f00;
  --surface: #fafbff;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  width: 2000px;
  height: 1125px;
  font-family: "Roboto", Arial, sans-serif;
  background: var(--surface);
  color: var(--primary-dark);
  overflow: hidden;
  position: relative;
}

.mono {
  font-family: "Roboto Mono", monospace;
}

.header {
  padding: 56px 72px 0;
}

.eyebrow {
  font-size: 22px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--primary);
  margin-bottom: 12px;
}

.title {
  font-size: 52px;
  font-weight: 700;
  color: var(--primary-dark);
  line-height: 1.15;
  max-width: 1650px;
}

.hook {
  font-size: 24px;
  font-weight: 400;
  font-style: italic;
  color: var(--primary-medium);
  margin-top: 14px;
  max-width: 1500px;
}

.score-strip {
  display: flex;
  align-items: center;
  gap: 20px;
  margin: 28px 72px 0;
  padding: 18px 32px;
  background: var(--primary-container);
  border-radius: 24px;
}

.score-strip .end-label {
  font-size: 20px;
  font-weight: 700;
  color: var(--primary-dark);
  width: 32px;
  text-align: center;
}

.score-strip .scale-bar {
  flex: 1;
  height: 14px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    #b3261e 0%,
    #ff8f00 25%,
    #ffffff 50%,
    #5c6bc0 75%,
    #00c853 100%
  );
  position: relative;
}

.score-strip .scale-bar::after {
  content: "";
  position: absolute;
  left: 50%;
  top: -6px;
  width: 3px;
  height: 26px;
  background: var(--primary-dark);
  transform: translateX(-50%);
  border-radius: 2px;
}

.score-strip .mid-caption {
  font-size: 18px;
  font-weight: 500;
  color: var(--primary-dark);
  white-space: nowrap;
}

.panels {
  display: flex;
  gap: 40px;
  margin: 36px 72px 0;
}

.card {
  flex: 1;
  background: #ffffff;
  border-radius: 28px;
  box-shadow: 0 2px 10px rgba(26, 35, 126, 0.08);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.card-header {
  padding: 22px 36px;
  background: var(--primary-dark);
  color: #ffffff;
  font-size: 23px;
  font-weight: 500;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
}

.card-header .as-of {
  font-size: 15px;
  font-weight: 400;
  color: var(--primary-light);
  white-space: nowrap;
}

.stat-rows {
  padding: 18px 36px;
  flex: 1;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  padding: 11px 0;
  border-bottom: 1px solid var(--primary-container);
  font-size: 20px;
}

.stat-row:last-child {
  border-bottom: none;
}

.stat-row .label {
  color: #3c3c4a;
  font-weight: 400;
}
.stat-row .value {
  font-weight: 500;
  text-align: right;
}
.stat-row .value.pos {
  color: var(--accent);
}
.stat-row .value.neg {
  color: var(--error);
}
.stat-row .value.warn {
  color: var(--warning);
}

.verdict {
  padding: 20px 36px;
  font-size: 21px;
  font-weight: 500;
  color: #ffffff;
}
.verdict.neg {
  background: var(--error);
}
.verdict.warn {
  background: var(--warning);
}
.verdict.pos {
  background: var(--accent);
}

.footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 135px;
  background: var(--primary-dark);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 72px;
}

.footer .wordmark {
  color: #ffffff;
  font-size: 28px;
  font-weight: 700;
}

.footer .coverage {
  display: flex;
  gap: 56px;
}

.footer .coverage .stat-tile {
  text-align: center;
}

.footer .coverage .stat-tile .num {
  font-size: 30px;
  font-weight: 700;
  color: #ffffff;
  font-family: "Roboto Mono", monospace;
}

.footer .coverage .stat-tile .cap {
  font-size: 13px;
  color: var(--primary-light);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

- [ ] **Step 2: Create a minimal smoke-test HTML that exercises every shared class**

```html
<!-- docs/superpowers/specs/assets/2026-07-20-audience-use-case-infographics/_smoke-test.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Smoke Test</title>
    <link rel="stylesheet" href="_shared.css" />
  </head>
  <body>
    <div class="header">
      <div class="eyebrow">PropertyIQ &middot; Smoke Test</div>
      <div class="title">Shared brand system check.</div>
      <div class="hook">
        Confirms fonts, colors, and shape tokens render correctly.
      </div>
    </div>
    <div class="score-strip">
      <span class="end-label">1</span>
      <div class="scale-bar"></div>
      <span class="end-label">99</span>
      <span class="mid-caption">50 = state average</span>
    </div>
    <div class="panels">
      <div class="card">
        <div class="card-header">
          <span>Card One</span><span class="as-of">as of 2026-07-20</span>
        </div>
        <div class="stat-rows">
          <div class="stat-row">
            <span class="label">Positive value</span
            ><span class="value mono pos">+12.3%</span>
          </div>
          <div class="stat-row">
            <span class="label">Negative value</span
            ><span class="value mono neg">-4.5%</span>
          </div>
          <div class="stat-row">
            <span class="label">Warning value</span
            ><span class="value mono warn">57 days</span>
          </div>
        </div>
        <div class="verdict warn">Warning-tone verdict banner</div>
      </div>
      <div class="card">
        <div class="card-header">
          <span>Card Two</span><span class="as-of">as of 2026-07-20</span>
        </div>
        <div class="stat-rows">
          <div class="stat-row">
            <span class="label">Neutral row</span
            ><span class="value mono">$550,000</span>
          </div>
        </div>
        <div class="verdict pos">Positive-tone verdict banner</div>
      </div>
    </div>
    <div class="footer">
      <div class="wordmark">PropertyIQ</div>
      <div class="coverage">
        <div class="stat-tile">
          <div class="num">900+</div>
          <div class="cap">Metros</div>
        </div>
        <div class="stat-tile">
          <div class="num">3,000+</div>
          <div class="cap">Counties</div>
        </div>
        <div class="stat-tile">
          <div class="num">29,000+</div>
          <div class="cap">ZIP Codes</div>
        </div>
      </div>
      <div class="wordmark" style="font-size:18px;font-weight:400;">
        Updated monthly
      </div>
    </div>
  </body>
</html>
```

- [ ] **Step 3: Render the smoke test and verify dimensions**

First, create the output directory (it does not exist yet):

```bash
mkdir -p packages/frontend/public/images/infographics
```

Load the Playwright tools (they are deferred): call `ToolSearch` with query `select:mcp__plugin_playwright_playwright__browser_navigate,mcp__plugin_playwright_playwright__browser_resize,mcp__plugin_playwright_playwright__browser_take_screenshot,mcp__plugin_playwright_playwright__browser_close`.

Then:

1. `browser_navigate` to `file:///D:/projects/rei-platform/docs/superpowers/specs/assets/2026-07-20-audience-use-case-infographics/_smoke-test.html`
2. `browser_resize` to width 2000, height 1125
3. `browser_take_screenshot` with an absolute output path of `D:/projects/rei-platform/packages/frontend/public/images/infographics/_smoke-test.png`, `fullPage: false`
4. `browser_close`

Run this dimension check:

```bash
node -e "const fs=require('fs');const b=fs.readFileSync('packages/frontend/public/images/infographics/_smoke-test.png');console.log('width:',b.readUInt32BE(16),'height:',b.readUInt32BE(20));"
```

Expected output: `width: 2000 height: 1125`

- [ ] **Step 4: Visually verify with the Read tool**

Read `packages/frontend/public/images/infographics/_smoke-test.png` and confirm: Roboto/Roboto Mono fonts rendered (not a fallback serif), indigo (#3949AB-family) colors visible, rounded-corner cards with shadow, green/red/amber tone colors correct on the three sample stat rows, footer bar with coverage tiles readable.

If fonts fall back to a generic sans-serif (Google Fonts CDN unreachable from the Playwright browser context), note this now — it affects Tasks 2-4 identically, so fix it here once (e.g. confirm network access works, or switch to a locally-available web-safe fallback stack `'Roboto', 'Segoe UI', Arial, sans-serif` and accept the fallback) rather than rediscovering it three more times.

- [ ] **Step 5: Delete the temporary smoke-test PNG (keep the HTML for future reuse) and commit the shared stylesheet**

```bash
rm packages/frontend/public/images/infographics/_smoke-test.png
git add docs/superpowers/specs/assets/2026-07-20-audience-use-case-infographics/_shared.css docs/superpowers/specs/assets/2026-07-20-audience-use-case-infographics/_smoke-test.html
git commit -m "feat(infographics): add shared brand stylesheet for audience use-case series"
```

---

### Task 2: Investor infographic

**Files:**

- Create: `docs/superpowers/specs/assets/2026-07-20-audience-use-case-infographics/investor-use-case.html`
- Output: `packages/frontend/public/images/infographics/investor-use-case.png`

**Interfaces:**

- Consumes: shared classes from Task 1's `_shared.css` (linked via `<link rel="stylesheet" href="_shared.css">`).

- [ ] **Step 1: Write the HTML**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>PropertyIQ for Investors</title>
    <link rel="stylesheet" href="_shared.css" />
  </head>
  <body>
    <div class="header">
      <div class="eyebrow">PropertyIQ &middot; For Investors</div>
      <div class="title">See exactly why a market scores what it scores.</div>
      <div class="hook">
        Concrete, falsifiable data &mdash; transparency about how the score is
        built.
      </div>
    </div>
    <div class="score-strip">
      <span class="end-label">1</span>
      <div class="scale-bar"></div>
      <span class="end-label">99</span>
      <span class="mid-caption">50 = state average</span>
    </div>
    <div class="panels">
      <div class="card">
        <div class="card-header">
          <span>Deal Analyzer</span>
          <span class="as-of"
            >Austin, TX &middot; 78704 &mdash; as of 2026-05-31</span
          >
        </div>
        <div class="stat-rows">
          <div class="stat-row">
            <span class="label">Purchase price</span
            ><span class="value mono">$550,000</span>
          </div>
          <div class="stat-row">
            <span class="label">Net cash flow</span
            ><span class="value mono neg">&minus;$2,224/mo</span>
          </div>
          <div class="stat-row">
            <span class="label">Cap rate</span
            ><span class="value mono neg">1.61%</span>
          </div>
          <div class="stat-row">
            <span class="label">Overvalued vs. fundamentals</span
            ><span class="value mono neg">+115.7%</span>
          </div>
          <div class="stat-row">
            <span class="label">PropertyIQ Score</span
            ><span class="value mono neg">7 &middot; F</span>
          </div>
        </div>
        <div class="verdict neg">
          &ldquo;Pass &mdash; negative cash flow, ~116% overvalued&rdquo;
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span>Market Contrast</span>
          <span class="as-of">Metro &middot; as of 2026-06-30</span>
        </div>
        <div class="stat-rows">
          <div class="stat-row">
            <span class="label">Seattle, WA &mdash; Score</span
            ><span class="value mono neg">16 &middot; F (&darr;40 in 3mo)</span>
          </div>
          <div class="stat-row">
            <span class="label">Seattle &mdash; Overvalued</span
            ><span class="value mono neg">89.1%</span>
          </div>
          <div class="stat-row">
            <span class="label">Seattle &mdash; Cap rate</span
            ><span class="value mono neg">2.19%</span>
          </div>
          <div class="stat-row">
            <span class="label">Buffalo, NY &mdash; Score</span
            ><span class="value mono pos">98 &middot; A+ (&uarr;6 in 3mo)</span>
          </div>
          <div class="stat-row">
            <span class="label">Buffalo &mdash; Overvalued</span
            ><span class="value mono pos">19.4%</span>
          </div>
          <div class="stat-row">
            <span class="label">Buffalo &mdash; Cap rate</span
            ><span class="value mono pos">3.57%</span>
          </div>
        </div>
        <div class="verdict pos">
          Same country, opposite momentum &mdash; the score flags the reversal
          before the headlines do.
        </div>
      </div>
    </div>
    <div class="footer">
      <div class="wordmark">PropertyIQ</div>
      <div class="coverage">
        <div class="stat-tile">
          <div class="num">900+</div>
          <div class="cap">Metros</div>
        </div>
        <div class="stat-tile">
          <div class="num">3,000+</div>
          <div class="cap">Counties</div>
        </div>
        <div class="stat-tile">
          <div class="num">29,000+</div>
          <div class="cap">ZIP Codes</div>
        </div>
      </div>
      <div class="wordmark" style="font-size:18px;font-weight:400;">
        Updated monthly
      </div>
    </div>
  </body>
</html>
```

- [ ] **Step 2: Render to PNG**

Using the already-loaded Playwright tools: `browser_navigate` to `file:///D:/projects/rei-platform/docs/superpowers/specs/assets/2026-07-20-audience-use-case-infographics/investor-use-case.html`, `browser_resize` to 2000x1125, `browser_take_screenshot` to `D:/projects/rei-platform/packages/frontend/public/images/infographics/investor-use-case.png` (`fullPage: false`), `browser_close`.

- [ ] **Step 3: Verify dimensions**

```bash
node -e "const fs=require('fs');const b=fs.readFileSync('packages/frontend/public/images/infographics/investor-use-case.png');console.log('width:',b.readUInt32BE(16),'height:',b.readUInt32BE(20));"
```

Expected: `width: 2000 height: 1125`

- [ ] **Step 4: Visually verify with the Read tool**

Read `packages/frontend/public/images/infographics/investor-use-case.png`. Confirm every stat listed in Step 1 is present and correctly toned (negative = red, positive = green), both "as of" dates are visible, and no text overflows a card or the footer.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/assets/2026-07-20-audience-use-case-infographics/investor-use-case.html packages/frontend/public/images/infographics/investor-use-case.png
git commit -m "feat(infographics): add Investor use-case infographic"
```

---

### Task 3: Homebuyer infographic

**Files:**

- Create: `docs/superpowers/specs/assets/2026-07-20-audience-use-case-infographics/homebuyer-use-case.html`
- Output: `packages/frontend/public/images/infographics/homebuyer-use-case.png`

**Interfaces:**

- Consumes: shared classes from Task 1's `_shared.css`.

- [ ] **Step 1: Write the HTML**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>PropertyIQ for Homebuyers</title>
    <link rel="stylesheet" href="_shared.css" />
  </head>
  <body>
    <div class="header">
      <div class="eyebrow">PropertyIQ &middot; For Homebuyers</div>
      <div class="title">Is now a good time to buy in your city?</div>
      <div class="hook">
        Real affordability math for your specific market &mdash; not a
        nationwide guess.
      </div>
    </div>
    <div class="score-strip">
      <span class="end-label">1</span>
      <div class="scale-bar"></div>
      <span class="end-label">99</span>
      <span class="mid-caption">50 = state average</span>
    </div>
    <div class="panels">
      <div class="card">
        <div class="card-header">
          <span>Affordability</span>
          <span class="as-of"
            >Austin, TX &middot; 78704 &mdash; as of 2026-05-31</span
          >
        </div>
        <div class="stat-rows">
          <div class="stat-row">
            <span class="label">Median home price</span
            ><span class="value mono">$733,554</span>
          </div>
          <div class="stat-row">
            <span class="label">Income needed to buy</span
            ><span class="value mono neg">$221,880</span>
          </div>
          <div class="stat-row">
            <span class="label">Median household income</span
            ><span class="value mono">$97,160</span>
          </div>
          <div class="stat-row">
            <span class="label">Affordable at median income</span
            ><span class="value mono">$361,262</span>
          </div>
          <div class="stat-row">
            <span class="label">Years to save a down payment</span
            ><span class="value mono neg">17</span>
          </div>
        </div>
        <div class="verdict warn">
          &ldquo;Buying needs 2.3&times; the local income &mdash; renting wins
          today&rdquo;
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span>Market Contrast</span>
          <span class="as-of">Metro &middot; as of 2026-06-30</span>
        </div>
        <div class="stat-rows">
          <div class="stat-row">
            <span class="label">Seattle, WA &mdash; Median home value</span
            ><span class="value mono neg">$745,263</span>
          </div>
          <div class="stat-row">
            <span class="label">Seattle &mdash; Score momentum</span
            ><span class="value mono neg">16 &middot; F, falling</span>
          </div>
          <div class="stat-row">
            <span class="label">Seattle &mdash; Years to save</span
            ><span class="value mono neg">12.5</span>
          </div>
          <div class="stat-row">
            <span class="label">Buffalo, NY &mdash; Median home value</span
            ><span class="value mono pos">$294,992</span>
          </div>
          <div class="stat-row">
            <span class="label">Buffalo &mdash; Score momentum</span
            ><span class="value mono pos">98 &middot; A+, rising</span>
          </div>
          <div class="stat-row">
            <span class="label">Buffalo &mdash; Years to save</span
            ><span class="value mono pos">7.7</span>
          </div>
        </div>
        <div class="verdict pos">
          Affordability and momentum don&rsquo;t always trade off &mdash;
          Buffalo has both right now.
        </div>
      </div>
    </div>
    <div class="footer">
      <div class="wordmark">PropertyIQ</div>
      <div class="coverage">
        <div class="stat-tile">
          <div class="num">900+</div>
          <div class="cap">Metros</div>
        </div>
        <div class="stat-tile">
          <div class="num">3,000+</div>
          <div class="cap">Counties</div>
        </div>
        <div class="stat-tile">
          <div class="num">29,000+</div>
          <div class="cap">ZIP Codes</div>
        </div>
      </div>
      <div class="wordmark" style="font-size:18px;font-weight:400;">
        Updated monthly
      </div>
    </div>
  </body>
</html>
```

- [ ] **Step 2: Render to PNG**

`browser_navigate` to `file:///D:/projects/rei-platform/docs/superpowers/specs/assets/2026-07-20-audience-use-case-infographics/homebuyer-use-case.html`, `browser_resize` to 2000x1125, `browser_take_screenshot` to `D:/projects/rei-platform/packages/frontend/public/images/infographics/homebuyer-use-case.png` (`fullPage: false`), `browser_close`.

- [ ] **Step 3: Verify dimensions**

```bash
node -e "const fs=require('fs');const b=fs.readFileSync('packages/frontend/public/images/infographics/homebuyer-use-case.png');console.log('width:',b.readUInt32BE(16),'height:',b.readUInt32BE(20));"
```

Expected: `width: 2000 height: 1125`

- [ ] **Step 4: Visually verify with the Read tool**

Read `packages/frontend/public/images/infographics/homebuyer-use-case.png`. Confirm all stats match Step 1 exactly, tone colors are correct, both "as of" dates visible, no overflow.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/assets/2026-07-20-audience-use-case-infographics/homebuyer-use-case.html packages/frontend/public/images/infographics/homebuyer-use-case.png
git commit -m "feat(infographics): add Homebuyer use-case infographic"
```

---

### Task 4: Agents infographic

**Files:**

- Create: `docs/superpowers/specs/assets/2026-07-20-audience-use-case-infographics/agents-use-case.html`
- Output: `packages/frontend/public/images/infographics/agents-use-case.png`

**Interfaces:**

- Consumes: shared classes from Task 1's `_shared.css`.

- [ ] **Step 1: Write the HTML**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>PropertyIQ for Agents</title>
    <link rel="stylesheet" href="_shared.css" />
  </head>
  <body>
    <div class="header">
      <div class="eyebrow">PropertyIQ &middot; For Agents</div>
      <div class="title">
        Walk into every listing with a market score and a narrative.
      </div>
      <div class="hook">Win listings with numbers, not instinct.</div>
    </div>
    <div class="score-strip">
      <span class="end-label">1</span>
      <div class="scale-bar"></div>
      <span class="end-label">99</span>
      <span class="mid-caption">50 = state average</span>
    </div>
    <div class="panels">
      <div class="card">
        <div class="card-header">
          <span>Listing Presentation</span>
          <span class="as-of"
            >Austin, TX &middot; 78704 &mdash; as of 2026-05-31</span
          >
        </div>
        <div class="stat-rows">
          <div class="stat-row">
            <span class="label">Median days on market</span
            ><span class="value mono">57 days</span>
          </div>
          <div class="stat-row">
            <span class="label">Price per sq ft</span
            ><span class="value mono">$572</span>
          </div>
          <div class="stat-row">
            <span class="label">Active inventory</span
            ><span class="value mono neg">374 (&minus;18.7% YoY)</span>
          </div>
          <div class="stat-row">
            <span class="label">New listings</span
            ><span class="value mono neg">96 (&minus;25% YoY)</span>
          </div>
          <div class="stat-row">
            <span class="label">Listings with price cuts</span
            ><span class="value mono neg">23.4%</span>
          </div>
          <div class="stat-row">
            <span class="label">Home values</span
            ><span class="value mono neg">&minus;10.81% YoY</span>
          </div>
        </div>
        <div class="verdict warn">
          &ldquo;Cooling + tight inventory &mdash; price it right or it
          sits&rdquo;
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span>Ask Claude &middot; MCP</span>
          <span class="as-of">Live tool call &mdash; as of 2026-05-31</span>
        </div>
        <div class="stat-rows">
          <div class="stat-row">
            <span class="label">Query</span
            ><span class="value"
              >&ldquo;What&rsquo;s the score for 78704?&rdquo;</span
            >
          </div>
          <div class="stat-row">
            <span class="label">Tool call</span
            ><span class="value mono">get_propertyiq_score(zip, 78704)</span>
          </div>
          <div class="stat-row">
            <span class="label">Score</span
            ><span class="value mono neg">7 &middot; F</span>
          </div>
          <div class="stat-row">
            <span class="label">Confidence</span
            ><span class="value mono pos">A</span>
          </div>
          <div class="stat-row">
            <span class="label">3-month trend</span
            ><span class="value mono neg">&minus;8</span>
          </div>
        </div>
        <div class="verdict pos">
          A real MCP tool call against live PropertyIQ data &mdash; plug it into
          Claude or any MCP client.
        </div>
      </div>
    </div>
    <div class="footer">
      <div class="wordmark">PropertyIQ</div>
      <div class="coverage">
        <div class="stat-tile">
          <div class="num">900+</div>
          <div class="cap">Metros</div>
        </div>
        <div class="stat-tile">
          <div class="num">3,000+</div>
          <div class="cap">Counties</div>
        </div>
        <div class="stat-tile">
          <div class="num">29,000+</div>
          <div class="cap">ZIP Codes</div>
        </div>
      </div>
      <div class="wordmark" style="font-size:18px;font-weight:400;">
        Updated monthly
      </div>
    </div>
  </body>
</html>
```

- [ ] **Step 2: Render to PNG**

`browser_navigate` to `file:///D:/projects/rei-platform/docs/superpowers/specs/assets/2026-07-20-audience-use-case-infographics/agents-use-case.html`, `browser_resize` to 2000x1125, `browser_take_screenshot` to `D:/projects/rei-platform/packages/frontend/public/images/infographics/agents-use-case.png` (`fullPage: false`), `browser_close`.

- [ ] **Step 3: Verify dimensions**

```bash
node -e "const fs=require('fs');const b=fs.readFileSync('packages/frontend/public/images/infographics/agents-use-case.png');console.log('width:',b.readUInt32BE(16),'height:',b.readUInt32BE(20));"
```

Expected: `width: 2000 height: 1125`

- [ ] **Step 4: Visually verify with the Read tool**

Read `packages/frontend/public/images/infographics/agents-use-case.png`. Confirm all stats match Step 1, the MCP tool-call panel reads clearly (monospace tool-call line legible), tone colors correct, both "as of" lines visible, no overflow.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/assets/2026-07-20-audience-use-case-infographics/agents-use-case.html packages/frontend/public/images/infographics/agents-use-case.png
git commit -m "feat(infographics): add Agents use-case infographic"
```

---

### Task 5: Series consistency check

**Files:**

- No new files. Verifies the 3 PNGs produced by Tasks 2-4.

**Interfaces:**

- Consumes: `packages/frontend/public/images/infographics/investor-use-case.png`, `homebuyer-use-case.png`, `agents-use-case.png`.

- [ ] **Step 1: Verify all 3 PNGs share identical dimensions**

```bash
for f in investor-use-case homebuyer-use-case agents-use-case; do
  node -e "const fs=require('fs');const b=fs.readFileSync('packages/frontend/public/images/infographics/$f.png');console.log('$f:', b.readUInt32BE(16), 'x', b.readUInt32BE(20));"
done
```

Expected: all three print `2000 x 1125`.

- [ ] **Step 2: Read all 3 PNGs side by side (three separate Read calls) and confirm series consistency**

Check: identical header/eyebrow/score-strip styling and position across all three; identical footer bar with identical coverage numbers (900+ / 3,000+ / 29,000+) and identical "Updated monthly" line; consistent card styling (same corner radius, same shadow, same card-header dark-indigo band) across all three; no leftover placeholder text (no "Lorem ipsum", no "TODO", no unstyled default browser font anywhere).

- [ ] **Step 3: Confirm no stray build artifacts were committed**

```bash
git status --short
```

Expected: clean (no `_smoke-test.png` or other temp files lingering — Task 1 Step 5 already deleted it, this just double-checks).

- [ ] **Step 4: Final wrap-up commit if anything was fixed in Steps 1-3**

If Step 2 surfaced a fix (e.g. a footer inconsistency), make the fix in the relevant `{slug}.html`, re-render per that task's Step 2-3, and commit:

```bash
git add docs/superpowers/specs/assets/2026-07-20-audience-use-case-infographics/<fixed-file>.html packages/frontend/public/images/infographics/<fixed-file>.png
git commit -m "fix(infographics): align <slug> with series-wide styling"
```

If nothing needed fixing, no commit is required for this task.

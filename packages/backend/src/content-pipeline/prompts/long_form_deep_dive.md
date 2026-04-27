Write a long-form narrative deep-dive script for {{canonical_name}}. Target total duration: 8 minutes at natural pace, roughly 1100 to 1300 words.

Data bundle:

{{dataBundle}}

Structure as 5 chapters. Each chapter gets 60 to 120 seconds of narration.

Chapter 1, Opening hook: lead with the most unexpected finding from the data. One minute.

Chapter 2, Market context: lead with **bundle-backed** numbers from `demographics`, `economic`, and related keys. You may add one or two sentences of **broad U.S. geographic context** (for example that a market is among the largest U.S. metros) that are not in the JSON, for audience orientation. For any number that comes from the Data bundle, use phrasing that matches the same scale the JSON uses (integers vs millions) so automated checking can align the script to the file. Two minutes.

Chapter 3, Real estate fundamentals: home values, rents, inventory, PropertyIQ Score with history. Three minutes.

Chapter 4, Who this market is for: investor profile, agent opportunity, broker positioning. One minute.

Chapter 5, Close plus CTA: {{cta_text}}{{shortLinkPlaceholder}}. One minute.

Hook options: produce {{variantCount}} hook variants for chapter 1 only.

Output JSON via the emit_script tool. Include one entry per chapter in **sceneBreakdown** with sceneKey set to chapter_1 through chapter_5 and **text** equal to that chapter’s narration (verbatim substring of fullText) so renders can sync visuals to timing.

Voice: informed but approachable. No filler; every sentence earns its place. Do not use em dash characters (use commas or periods). Only "PropertyIQ Score" or "PIQ Score" for scores.

**Data grounding:** All **market-specific metrics** (scores, prices, rents, inventory, PIQ trends, etc.) must come from the Data bundle. Broad geographic framing without contradicting the bundle is acceptable; optional layers (Census-style population totals, national metro stature) may be used where the narrative needs context—Gate A separately checks bundle-backed figures and records waived context claims for audit.

**Data confidence:** The bundle includes `score.confidence` as a single letter A through F (data quality for the PropertyIQ Score). If you mention confidence in the narration, that letter must match `score.confidence` exactly. Do not invent a different letter.

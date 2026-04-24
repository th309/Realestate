<!-- packages/backend/src/content-pipeline/prompts/head_to_head.md -->

Write a {{video_duration_seconds}}-second Head-to-Head comparison script for {{canonical_name}}.

**Timing constraint (hard):** the voice-over must finish in {{audio_budget_seconds}} seconds or less at a natural, unhurried pace (~{{natural_wpm}} words per minute). Target approximately {{word_budget}} words total. Do not exceed this — a script that's too long will get cut off mid-sentence by the video edit. Slightly under is fine; over is not.

Data bundle (authoritative, do not use any other numbers):
{{dataBundle}}

This script compares the two markets present in the data bundle. Refer to them by their names as they appear in the bundle. Do not invent a third market or pull names from outside the bundle.

Structure: open with the most surprising contrast in the data, then walk through PropertyIQ Score, home values and rents, and economic indicators side by side, then deliver a verdict grounded in the numbers. Close with this CTA verbatim: {{cta_text}}{{shortLinkPlaceholder}}

Hook options: produce {{variantCount}} alternative hooks. Hook A leads with the single biggest gap between the two markets in the bundle (e.g. "[Market 1] beats [Market 2] by [N] points on PropertyIQ Score."). Hook B (if variantCount=2) leads with a counterintuitive framing, where the cheaper or smaller market in the bundle outperforms the larger one on a specific metric. Use only names and numbers from the data bundle.

Scene hints — allocate durations so the sum equals {{video_duration_seconds}}s, with the voice-over ending by {{audio_budget_seconds}}s:

- Hook with contrast callout (3s)
- PropertyIQ Score head-to-head (10s)
- Home values and rents head-to-head (15s)
- Economic indicators head-to-head (15s)
- Verdict (10s)
- CTA card (7s)

Count your words before emitting. If your script is over {{word_budget}} words, cut until it fits — trim adjectives, combine short sentences, drop one of the supporting stats per section if needed. Don't pad with filler to hit the number either; concise and natural beats padded.

Output a tool_use call matching the schema.

<!-- packages/backend/src/content-pipeline/prompts/farm_area_spotlight.md -->

Write a {{video_duration_seconds}}-second Farm Area Spotlight script for {{canonical_name}}, aimed at real estate agents building a farm.

**Timing constraint (hard):** the voice-over must finish in {{audio_budget_seconds}} seconds or less at a natural, unhurried pace (~{{natural_wpm}} words per minute). Target approximately {{word_budget}} words total. Do not exceed this — a script that's too long will get cut off mid-sentence by the video edit. Slightly under is fine; over is not.

Data bundle (authoritative, do not use any other numbers):
{{dataBundle}}

Tone: professional, direct, useful to a working agent. Not salesy, not influencer-style. Talk like a colleague sharing a tip, not a pitch.

Structure: open with the agent-targeted hook, then walk through three farm areas from the data bundle. For each area, name the ZIP code, cite one key stat from the bundle (turnover rate, median price, or absentee-owner rate), and explain in one line why it matters for an agent's book of business. Close with this CTA verbatim: {{cta_text}}{{shortLinkPlaceholder}}

Hook options: produce {{variantCount}} alternative hooks. Hook A opens directly to the agent ("If you're an agent in {{canonical_name}}, these three ZIPs deserve a closer look."). Hook B (if variantCount=2) leads with the strongest single stat across the three areas in the bundle (e.g. "One ZIP in {{canonical_name}} just hit a [N]% turnover rate."). Use only ZIPs and numbers that appear in the data bundle.

Scene hints — allocate durations so the sum equals {{video_duration_seconds}}s, with the voice-over ending by {{audio_budget_seconds}}s:

- Hook (3s)
- Farm area 1 card (15s)
- Farm area 2 card (15s)
- Farm area 3 card (15s)
- Outro / CTA card (12s)

Count your words before emitting. If your script is over {{word_budget}} words, cut until it fits — trim adjectives, combine short sentences, tighten the "why it matters" line on each area. Don't pad with filler to hit the number either; concise and natural beats padded.

Output a tool_use call matching the schema.

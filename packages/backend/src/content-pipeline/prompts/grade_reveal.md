<!-- packages/backend/src/content-pipeline/prompts/grade_reveal.md -->

Write a {{video_duration_seconds}}-second Grade Reveal script for {{canonical_name}}.

**Timing constraint (hard):** the voice-over must finish in {{audio_budget_seconds}} seconds or less at a natural, unhurried pace (~{{natural_wpm}} words per minute). Target approximately {{word_budget}} words total. Do not exceed this — a script that's too long will get cut off mid-sentence by the video edit. Slightly under is fine; over is not.

Data bundle (authoritative, do not use any other numbers):
{{dataBundle}}

Structure: open with the PropertyIQ Score and grade letter, explain what the score represents in one line, cite two supporting stats from the data bundle, close with this CTA verbatim: {{cta_text}}{{shortLinkPlaceholder}}

Hook options: produce {{variantCount}} alternative hooks. Hook A leads with the score number ("Cleveland's PropertyIQ Score just hit 78"). Hook B (if variantCount=2) leads with a contrast ("Most investors miss this: Cleveland outscores Austin by 9 points on PIQ").

Scene hints — allocate durations so the sum equals {{video_duration_seconds}}s, with the voice-over ending by {{audio_budget_seconds}}s:

- Intro
- Score reveal with PIQ ring
- Stat cards with 4 key metrics
- CTA card

Count your words before emitting. If your script is over {{word_budget}} words, cut until it fits — trim adjectives, combine short sentences, drop a supporting stat if needed. Don't pad with filler to hit the number either; concise and natural beats padded.

Output a tool_use call matching the schema.

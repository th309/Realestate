<!-- packages/backend/src/content-pipeline/prompts/top_10_ranking.md -->

Write a {{video_duration_seconds}}-second Top 10 Ranking script for {{canonical_name}}.

**Timing constraint (hard):** the voice-over must finish in {{audio_budget_seconds}} seconds or less at a natural, unhurried pace (~{{natural_wpm}} words per minute). Target approximately {{word_budget}} words total. Do not exceed this — a script that's too long will get cut off mid-sentence by the video edit. Slightly under is fine; over is not.

Data bundle (authoritative, do not use any other numbers):
{{dataBundle}}

Structure: open with the headline ranking, count down from #10 to #1, citing the rent-to-price ratio AND PropertyIQ Score for each market on the list. Spend roughly 3 to 4 seconds per market. Close with this CTA verbatim: {{cta_text}}{{shortLinkPlaceholder}}

Hook options: produce {{variantCount}} alternative hooks. Hook A leads with the #1 market by name, pulled from the data bundle (e.g. "The number one cashflow market this month is [market from bundle]"). Hook B (if variantCount=2) leads with a surprising omission, naming a major metro from the bundle's excluded or absent list (e.g. "[Major metro from bundle] didn't make the top 10 this month — here's who did."). Use only names that appear in the data bundle. Do not invent markets.

Scene hints — allocate durations so the sum equals {{video_duration_seconds}}s, with the voice-over ending by {{audio_budget_seconds}}s:

- Intro / hook (3s)
- Ten ranking rows, ~4s each, counting down from #10 to #1 (40s total)
- Outro / takeaway (10s)
- CTA card (7s)

Count your words before emitting. If your script is over {{word_budget}} words, cut until it fits — trim adjectives, combine short sentences, drop a supporting stat from one of the lower-ranked markets if needed. Don't pad with filler to hit the number either; concise and natural beats padded.

Output a tool_use call matching the schema.

You are writing a voiceover script for a PropertyIQ "Bottom 10 Ranking" video — markets where the metric is at its weakest.

**Timing constraint (hard):** voice-over must finish in {{audio_budget_seconds}} seconds or less at ~{{natural_wpm}} words per minute. Target approximately {{word_budget}} words **total** across hook + all rows + outro. Do not exceed — overflow trips the synthesis gate and forces a retry. Slightly under is fine.

Word budget breakdown for guidance (final allocation is yours):

- Hook intro_vo: ~12–15 words
- Each row VO: ~9–12 words
- Outro VO: ~8–10 words
- Outro CTA (fixed string): "Learn more at propertyiq.app." — 5 words

Count your words before emitting. If your draft exceeds {{word_budget}}, tighten the hook and outro before touching row VOs.

# Inputs you will receive

- `metric.label` — what's being ranked (e.g. "PropertyIQ Score", "Cap Rate", "Days on Market")
- `metric.unit` — display unit ("%", "$", etc. — empty for indices)
- `metric.format` — how values are formatted (currency / percent / index / days / number)
- `metric_thesis` — a 1-line investor-relevant statement about what this metric signals (e.g. "Demand intensity today is the leading indicator for tomorrow's appreciation."). May be `null`.
- `scope.label` — geographic scope ("United States", "California", "Tampa-St. Petersburg, FL")
- `geo_level` — "metro" | "county" | "zip"
- `direction` — always "bottom" for this template
- `resolved_markets` — array of N (5–10) entries: `{ rank, region_name, state, value, value_formatted }`, sorted #1 worst → #N least-worst

# Narrative framing — read this first

A bottom-10 ranking is not a hit-piece. It's the **inverse case** of the same thesis: when this metric is _low_, what does that signal? Frame it as information, not warning theater.

- **Hooks** must convey _what a low value of this metric means for an investor or agent_ — paraphrasing or echoing the inverse implication of `metric_thesis`. Not just "ten markets to avoid."
- **#1 reveal** carries a one-line beat that grounds the worst case in the inverted thesis. Stay grounded in what the data measures.
- **Outro** ties back to the thesis with PropertyIQ's brand promise.

If `metric_thesis` is provided, treat it as ground truth. The bottom-10 framing is the inverse of the same statement (e.g. PIQ thesis = "demand intensity is the leading indicator" → bottom-10 framing = "the markets running coolest right now").

If `metric_thesis` is `null`, derive framing from `metric.label` and describe what a low value of the metric measures.

# Brand voice

- Apple keynote: declarative, confident, sparse
- Cadence ~{{natural_wpm}} wpm → ~25 syllables per row line max
- No filler words
- **No causal claims the data doesn't support.** "Where demand is coolest" ≠ "where prices will fall."
- Do NOT moralize or dramatize. No "avoid these" or "don't put your money in any of these." Information, not theater.
- Honor the punchline cadence: #1 reveal gets a beat of silence before VO

# Number formatting

| Display   | Spoken                          |
| --------- | ------------------------------- |
| `12.4%`   | "twelve point four percent"     |
| `$1.2M`   | "one point two million dollars" |
| `28 days` | "twenty-eight days"             |
| `87`      | "eighty-seven"                  |

# Reveal cadence

Always count down from #N → #1, regardless of N. Save #1 (the lowest) as the punchline.

# Output

Return ONLY a JSON object matching this schema (no commentary, no markdown fences):

```json
{
  "hooks": [
    { "id": "data-led", "intro_vo": "...", "subhead_text": "..." },
    { "id": "stakes-led",  "intro_vo": "...", "subhead_text": "..." }
  ],
  "rows": [
    { "rank": <N>, "vo": "Number <N>. <region_name>, <state>. <spoken value>.", "emphasis": "name" | "value" },
    ...
    { "rank": 1, "vo": "...", "emphasis": "name" }
  ],
  "outro_vo": "...",
  "outro_cta": "Learn more at propertyiq.app."
}
```

# Hook variants (always produce both)

Both hooks must convey the inverse of the metric's thesis, not just announce a worst-of list.

- `data-led`: state the inverse of the thesis straight, then frame the ranking as the proof. Example shape: "[Inverse of thesis]. [N markets] in [scope]. Top to bottom."
- `stakes-led`: name what's at stake when this metric is low — informational, not alarmist. Example shape: "[What's at risk when this is low]. Here's where it's lowest."

# Outro guidance

- `outro_vo`: 1 short sentence (≤10 words) that echoes the inverted thesis. Examples:
  - PIQ Score (low): "Cooling pressure. Worth watching."
  - Cap Rate (low): "Where the income compresses first."
  - Cap Rate is favorable-direction-higher, so bottom-10 = lowest yields.
    Keep it punchy. Tie to the metric.
- `outro_cta` MUST be exactly: "Learn more at propertyiq.app."

# Rules

- `rows` length MUST equal `resolved_markets` length
- Each row's `rank` MUST equal the corresponding `resolved_markets` rank
- `region_name` and `state` MUST appear verbatim in the VO (do not paraphrase, abbreviate, or substitute)
- Do NOT mention any market that is not in `resolved_markets`
- Do NOT mention `excluded_count` or describe missing data
- Do NOT make forward-looking claims unless `metric_thesis` explicitly supports them

# Example (for shape only — your input will differ)

Input:

```
metric: { label: "PropertyIQ Score", unit: "", format: "index" }
metric_thesis: "Demand intensity today is the leading indicator for tomorrow's appreciation. PropertyIQ measures it: percent sold above list, days on market, months of supply — versus state peers."
scope:  { label: "United States" }
geo_level: "metro"
resolved_markets: [
  { rank: 1, region_name: "Lake County", state: "TX", value: 12, value_formatted: "12" },
  ...
]
```

Output (illustrative):

- Hook (data-led): "Demand pressure is the leading indicator for appreciation. Here are the ten metros where it's coolest right now. Top to bottom."
- Row #10: "Number ten. Travis County, Texas. Twenty-four."
- Row #1: "And number one. Lake County, Texas. Twelve. The coolest demand in the country."
- Outro: "Cooling pressure. The IQ behind every market." → "Learn more at propertyiq.app."

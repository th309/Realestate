<!-- packages/backend/src/content-pipeline/prompts/score_mover.md -->

Write a {{video_duration_seconds}}-second Score Mover script for {{canonical_name}}. The reported change is the move {{window_label}} — fit the time-window phrase into the hook only; do NOT add it again in the body.

**Timing constraint (hard):** the voice-over must finish in {{audio_budget_seconds}} seconds or less at a natural, unhurried pace (~{{natural_wpm}} words per minute). Target approximately {{word_budget}} words total. Do not exceed this — a script that's too long will get cut off mid-sentence by the video edit. Slightly under is fine; over is not.

Data bundle (authoritative, do not use any other numbers):
{{dataBundle}}

Structure: open with the PropertyIQ Score delta from the data bundle, name the two supporting metrics in the bundle that drove the move, then state in one specific sentence what the move means for an investor (grounded in the bundle's numbers, not a generic platitude). Close with this CTA verbatim: {{cta_text}}{{shortLinkPlaceholder}}

Hook options: produce {{variantCount}} alternative hooks. Hook A leads with the delta itself, using the actual number from the data bundle (e.g. "{{canonical_name}}'s PropertyIQ Score jumped [N] points {{window_label}}."). Hook B (if variantCount=2) leads with the direction-reversal angle, framing whether the market is heating up or cooling down based on the sign of the delta in the bundle.

Scene hints — allocate durations so the sum equals {{video_duration_seconds}}s, with the voice-over ending by {{audio_budget_seconds}}s:

- Hook with delta callout (2s)
- Body: two supporting metrics from the bundle (15s)
- Context: what the move means for investors (10s)
- CTA card (3s)

Count your words before emitting. If your script is over {{word_budget}} words, cut until it fits — trim adjectives, combine short sentences, tighten the context sentence. Don't pad with filler to hit the number either; concise and natural beats padded.

Output a tool_use call matching the schema.

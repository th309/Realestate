<!-- packages/backend/src/content-pipeline/prompts/grade_reveal.md -->

Write a 30-second Grade Reveal script for {{canonical_name}}.

Data bundle (authoritative, do not use any other numbers):
{{dataBundle}}

Structure: open with the PropertyIQ Score and grade letter, explain what the score represents in one line, cite two supporting stats from the data bundle, close with this CTA verbatim: {{cta_text}}{{shortLinkPlaceholder}}

Hook options: produce {{variantCount}} alternative hooks. Hook A leads with the score number ("Cleveland's PropertyIQ Score just hit 78"). Hook B (if variantCount=2) leads with a contrast ("Most investors miss this: Cleveland outscores Austin by 9 points on PIQ").

Scene hints (30 seconds total):

- Intro (2s)
- Score reveal with PIQ ring (7s)
- Stat cards with 4 key metrics (8s)
- CTA card (3s)
- Total scripted text approximately 70-80 words.

Output a tool_use call matching the schema.

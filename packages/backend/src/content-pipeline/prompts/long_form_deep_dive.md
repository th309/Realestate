Write a long-form narrative deep-dive script for {{canonical_name}}.

**Hard limits (non-negotiable)**  
- Final video length is **{{video_duration_seconds}}** seconds.  
- Recorded voice-over must **finish within {{audio_budget_seconds}} seconds** of spoken audio (about **{{word_budget}}** words at ~**{{natural_wpm}}** words per minute).  
- Do **not** exceed that word budget — longer scripts fail at synthesis.  
- Reserve the last few seconds of the timeline for on-screen outro and brand; the spoken narration itself must stay within **{{audio_budget_seconds}}** seconds total.

Data bundle:

{{dataBundle}}

Structure as **5 chapters** in **sceneBreakdown** (chapter_1 … chapter_5). Allocate time **across** chapters so the **total** narration fits **{{audio_budget_seconds}}** seconds — chapter 3 (fundamentals) may be the longest segment; keep chapter 1 tight.

Suggested balance (adjust as needed to hit the word budget):

1. **Chapter 1 — Hook:** Lead with the strongest data-backed surprise. ~45–55 seconds spoken.  
2. **Chapter 2 — Market context:** Bundle-backed demographics, economic, and related metrics. You may add one or two sentences of broad U.S. geographic context not in the JSON. ~55–70 seconds.  
3. **Chapter 3 — Real estate fundamentals:** Home values, rents, inventory, PropertyIQ Score and history. This chapter may run longest if space allows. ~85–100 seconds.  
4. **Chapter 4 — Who this market is for:** Investor profile, agent/broker angle. ~40–50 seconds.  
5. **Chapter 5 — Close + CTA:** {{cta_text}}{{shortLinkPlaceholder}}. ~35–45 seconds.

Hook options: produce {{variantCount}} hook variants for chapter 1 only.

Output JSON via the emit_script tool. Include one entry per chapter in **sceneBreakdown** with sceneKey set to chapter_1 through chapter_5 and **text** equal to that chapter’s narration (verbatim substring of fullText) so renders can sync visuals to timing.

Voice: informed but approachable. No filler; every sentence earns its place. Do not use em dash characters (use commas or periods). Only "PropertyIQ Score" or "PIQ Score" for scores.

**Data grounding:** All **market-specific metrics** (scores, prices, rents, inventory, PIQ trends, etc.) must come from the Data bundle. Broad geographic framing without contradicting the bundle is acceptable; optional layers (Census-style population totals, national metro stature) may be used where the narrative needs context—Gate A separately checks bundle-backed figures and records waived context claims for audit.

**Data confidence:** The bundle includes `score.confidence` as a single letter A through F (data quality for the PropertyIQ Score). If you mention confidence in the narration, that letter must match `score.confidence` exactly. Do not invent a different letter.

For any number that comes from the Data bundle, use phrasing that matches the same scale the JSON uses (integers vs millions) so automated checking can align the script to the file.

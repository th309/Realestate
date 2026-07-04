# Google SEO Rubric — Cluster 8: AI / Generative Engine Optimization (AI Overviews, AI Mode, ChatGPT, Perplexity)

> **Source of authority (Part A):** Google Search Central documentation at `developers.google.com` (read 2026-06-19). This is the authoritative layer — Google's own words.
> **Source of context (Part B):** Operator docs (OpenAI, Anthropic, Perplexity, Microsoft) + reputable 2025-2026 GEO research (the GEO paper, Aggarwal et al., KDD 2024) and large-sample citation studies. This is the **industry / emerging** layer — clearly labeled as such, NOT Google guidance.
> **Applied to:** PropertyIQ — a real-estate market-data SaaS publishing **33,000+ programmatically generated location pages** (states, metros, counties, ZIPs), each dense with specific numbers (median price, rent, PropertyIQ Score, days-on-market) and dates. This is the **ideal citable-fact substrate** for generative engines; the whole job is to expose those facts cleanly and stay crawlable.
>
> **How to read this file:** Each rule is `(a)` the rule, `(b)` WHY, `(c)` HOW to implement on PropertyIQ, `(d)` source URL, `(e)` severity. Verbatim quotes are in `"quotation marks"`. **"Google says" rules (G-prefix) are authoritative; "Industry / emerging" rules (I-prefix) are best-practice from research, not Google policy.**
>
> **Severity key:** **CRITICAL** = blocks citation/indexing entirely or wastes the whole opportunity • **HIGH** = strong citation/visibility loss • **MEDIUM** = lost opportunity / weakened citability • **LOW** = polish / low-cost experiment.

---

## The single most important framing (read this first)

There are two independent questions, and conflating them is the #1 GEO mistake:

1. **Can the engine SEE your content?** — governed by crawlability + the right crawler being **allowed** (robots.txt). Training crawlers and citation/search crawlers are **different bots**; blocking the training bot is citation-safe, blocking the search bot is not.
2. **Will the engine CITE your content?** — governed by passage-level extractable facts: specific numbers, in clear declarative sentences, with dates and named sources.

**Google's position collapses the second question into ordinary SEO.** Verbatim: `"There are no additional requirements to appear in AI Overviews or AI Mode, nor other special optimizations necessary."` (G-source A1). There is no "AI SEO" trick, no special markup, no AI-only file. AI Overviews and AI Mode run on the **regular Search index**, so eligibility = indexed + crawlable by **Googlebot** + snippet-eligible. Everything in Clusters 1 (content quality / E-E-A-T) and 4 (sitemaps) IS the AI-Overviews strategy.

The **off-Google** engines (ChatGPT, Perplexity, Copilot) add one mechanical requirement Google does not: you must allow **their** search/retrieval crawlers, which are distinct from their training crawlers. That's the robots.txt matrix in Section B1, and it's the one place PropertyIQ's current config needs attention.

For a 33k-page data site the citable-fact substrate is already there. The research is unambiguous that the three highest-impact on-page tactics — **adding statistics, citing sources, and adding quotations** — produced a **30-40% relative lift** in generative-engine visibility in a controlled 10,000-query experiment, and the **only** tactic that _hurt_ was keyword stuffing (−8 to −9%). A data page that front-loads answers, names its sources, and isn't templated into thin boilerplate is structurally the ideal generative artifact.

---

# PART A — GOOGLE'S OWN GUIDANCE (AUTHORITATIVE)

## Sources read (Google Search Central)

| #   | Page                                                                       | URL                                                                                                |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| GA1 | AI features and your website (AI Overviews / AI Mode)                      | https://developers.google.com/search/docs/appearance/ai-features                                   |
| GA2 | Optimizing your website for generative AI features on Google Search        | https://developers.google.com/search/docs/fundamentals/ai-optimization-guide                       |
| GA3 | Creating helpful, reliable, people-first content (E-E-A-T)                 | https://developers.google.com/search/docs/fundamentals/creating-helpful-content                    |
| GA4 | Google Search's guidance about AI-generated content (blog, Feb 2023)       | https://developers.google.com/search/blog/2023/02/google-search-and-ai-content                     |
| GA5 | Top ways to ensure your content performs well in AI experiences (May 2025) | https://developers.google.com/search/blog/2025/05/succeeding-in-ai-search                          |
| GA6 | Google-Extended (Google common crawlers)                                   | https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers#google-extended |

---

## G1 — Google publishes NO special "how to rank in AI Overviews" rules; classic best practices ARE the strategy

- **(a) Rule:** Do not chase AI-only optimizations. There is no special markup, no AI text file, and no special schema required for AI Overviews or AI Mode. Optimize for Search and you have optimized for Google's AI features.
- **(b) WHY (Google, verbatim):** `"There are no additional requirements to appear in AI Overviews or AI Mode, nor other special optimizations necessary."` (GA1) and `"You don't need to create new machine readable files, AI text files, or markup to appear in these features. There's also no special schema.org structured data that you need to add."` (GA1). From the fundamentals guide: `"The best practices for SEO continue to be relevant because our generative AI features on Google Search are rooted in our core Search ranking and quality systems"` and `"optimizing for generative AI search is optimizing for the search experience, and thus still SEO."` (GA2). The 2025 blog reaffirms: `"The underpinnings of what Google has long advised carries across to these new experiences."` (GA5).
- **(c) HOW (PropertyIQ):** Treat Clusters 1 (helpful content / E-E-A-T) and 4 (sitemaps / crawlability) as the AI-Overviews program. Do not build a parallel "AI SEO" track. Do not spend effort on speculative AI-only markup. Keep the existing `Dataset` + `BreadcrumbList` JSON-LD because it is good Search hygiene (G3), not because Google promises it boosts AI citation.
- **(d) Source:** GA1; GA2; GA5
- **(e) Severity:** **HIGH** (mis-prioritization risk) — protects against wasting effort on AI-only myths instead of the fundamentals that actually drive eligibility.

## G2 — AI-feature eligibility = indexed + crawlable by Googlebot + snippet-eligible (nothing more)

- **(a) Rule:** A page is eligible to appear as a supporting link in AI Overviews / AI Mode if, and only if, it meets the normal Search technical requirements: indexed, crawlable by **Googlebot**, and eligible to show a snippet. There is no separate AI gate and no separate AI crawler to allow.
- **(b) WHY (Google, verbatim):** `"To be eligible to be shown as a supporting link in AI Overviews or AI Mode, a page must be indexed and eligible to be shown in Google Search with a snippet, fulfilling the Search technical requirements."` (GA1). And: `"ensure your content is crawlable, as Google Search generative AI models use publicly accessible, crawlable content."` (GA2). Critically, this means **Googlebot** — not Google-Extended — governs AI-feature visibility: `"AI is built into Search and integral to how Search functions, which is why robots.txt directives for Googlebot is the control for site owners to manage access to how their sites are crawled for Search."` (GA1).
- **(c) HOW (PropertyIQ):** Confirm `robots.ts` never disallows Googlebot from any indexable location page. The current config allows `/` to `*` (which includes Googlebot) and blocks only `/api/`, `/admin/`, `/auth/`, `/account/` — correct. Keep every `/markets/...` path crawlable. Snippet eligibility: do **not** set `nosnippet`/`max-snippet:0` on location pages (PropertyIQ does not — verify it stays that way). Index coverage is the lever, and it's already handled by the sitemap index (Cluster 4).
- **(d) Source:** GA1; GA2
- **(e) Severity:** **CRITICAL** — blocking Googlebot or suppressing snippets removes the page from both Search and AI features simultaneously. This is the one hard gate.

## G3 — Structured data is a hygiene/eligibility support signal, NOT a Google-promised AI-citation booster; it must match visible text

- **(a) Rule:** Use structured data for Search rich results and entity comprehension, but do not expect Google to reward it with AI citations, and never let schema state facts that aren't in the visible HTML.
- **(b) WHY (Google, verbatim):** `"Structured data isn't required for generative AI search, and there's no special schema.org markup you need to add."` (GA2). The only AI-context instruction Google gives about schema is a hygiene rule: `"Make sure that all the content in your markup is also visible on your web page."` (GA5) / `"Making sure your structured data matches the visible text on the page."` (GA1). Google is deliberately silent on schema conferring any AI-citation advantage. (Industry data in I-rules below is mixed-to-negative on direct lift — see I5.)
- **(c) HOW (PropertyIQ):** Keep the `Dataset` JSON-LD (`buildStatsJsonLd.ts`) and `BreadcrumbList` — both are legitimate Search rich-result / entity signals. **Verify the schema-to-visible-text invariant:** every `variableMeasured` PropertyValue (median price, rent, days-on-market, YoY) and its `observationDate` MUST also appear as visible text on the page. Today the `Dataset` carries `dateModified` and `observationDate` per metric — make sure the same numbers and dates render in the visible `MarketStatsBlock`, not only in JSON-LD (AI retrieval reads visible HTML; see I1/I5).
- **(d) Source:** GA1; GA2; GA5
- **(e) Severity:** **MEDIUM** — schema helps Search/entity resolution; a schema-vs-visible mismatch is a trust/quality risk, but absence of schema does not block AI features.

## G4 — People-first, helpful content + E-E-A-T (Trust is paramount) is the through-line for BOTH classic and AI search

- **(a) Rule:** Every location page must be created primarily for people, demonstrate first-hand expertise/depth, and — above all — be trustworthy. This is what Google's systems (classic and AI) try to reward.
- **(b) WHY (Google, verbatim):** Google routes AI-feature success straight back to helpful content: `"focusing on the key best practices, such as creating helpful, reliable, people-first content."` (GA1). E-E-A-T: `"They identify a mix of factors that can help determine which content demonstrates aspects of experience, expertise, authoritativeness, and trustworthiness, or what we call E-E-A-T."` and the anchor: `"Of these aspects, trust is most important. The others contribute to trust, but content doesn't necessarily have to demonstrate all of them."` (GA3). The decisive test is the creator's "Why": `"'Why' is perhaps the most important question to answer about your content."` (GA3). Real estate is **YMYL** (financial), so this bar is high.
- **(c) HOW (PropertyIQ):** Each market page must answer a real question a real investor/agent/buyer would type, with data + analysis they can't trivially get elsewhere (the proprietary PropertyIQ Score, forecasts, and YoY context are the moat). Surface trust signals: a `/scores/methodology` page, named data sources, an About/analyst byline, "last updated" dates. Avoid thin near-duplicate templating across 33k pages (this is also the GEO anti-pattern — see I9). Cross-reference Cluster 1 for the full E-E-A-T checklist.
- **(d) Source:** GA1; GA3
- **(e) Severity:** **HIGH** — weak/thin/untrustworthy content suppresses both Search ranking and AI-feature inclusion; in YMYL it can deindex.

## G5 — AI-generated content is allowed; Google rewards quality "however it is produced" — but scaled manipulation is spam

- **(a) Rule:** PropertyIQ's programmatic + AI-assisted page generation is fine _as policy_, provided each page is genuinely helpful and not produced primarily to manipulate ranking.
- **(b) WHY (Google, verbatim):** `"Our focus on the quality of content, rather than how content is produced, is a useful guide that has helped us deliver reliable, high quality results to users for years."` (GA4). The boundary: `"Appropriate use of AI or automation is not against our guidelines. This means that it is not used to generate content primarily to manipulate search rankings, which is against our spam policies."` and `"Using automation—including AI—to generate content with the primary purpose of manipulating ranking in search results is a violation of our spam policies."` (GA4). The load-bearing clause from the spam policy (see Cluster 1): scaled content abuse is `"unoriginal content that provides little to no value to users, no matter how it's created."`
- **(c) HOW (PropertyIQ):** Each of the 33k pages must carry distinct, real value: this city's actual numbers, YoY change, rank vs state/nation, a market-specific narrative — not a boilerplate shell with the city name swapped in. The AI-generated SEO narrative (`generate-seo-content`) is acceptable only because it sits on top of genuinely unique data per page. Keep eligibility gating: do not publish a page for a region with insufficient data (consolidate sparse regions into richer hubs).
- **(d) Source:** GA4
- **(e) Severity:** **CRITICAL** (at scale) — 33k thin templated pages "to manipulate ranking" is exactly the scaled-content-abuse pattern; genuine per-page value is what keeps the strategy compliant.

## G6 — Blocking Google-Extended does NOT affect Search ranking OR AI Overviews; it only opts out of Gemini/Vertex training

- **(a) Rule:** `Google-Extended` is a Gemini-Apps / Vertex-AI training+grounding opt-out token only. Setting it to `Disallow` is **citation-safe**: it does not remove you from Google Search and does not remove you from AI Overviews / AI Mode (those run on the Googlebot Search index).
- **(b) WHY (Google, verbatim):** `"Google-Extended is a standalone product token that web publishers can use to manage whether content Google crawls from their sites may be used for training future generations of Gemini models that power Gemini Apps and Vertex AI API for Gemini and for grounding ... in Gemini Apps and Grounding with Google Search on Vertex AI."` (GA6). And the load-bearing line: `"Google-Extended does not impact a site's inclusion in Google Search nor is it used as a ranking signal in Google Search."` (GA6). Combined with G2 (`"robots.txt directives for Googlebot is the control"` for AI-in-Search), the conclusion is firm: AI Overviews visibility is governed by **Googlebot**, never by Google-Extended.
- **(c) HOW (PropertyIQ):** Decision is purely about Gemini/Vertex _model training_, with **zero** Search/AI-Overviews cost either way. PropertyIQ's data is its product — there is a defensible argument to `Disallow: Google-Extended` to keep the proprietary PropertyIQ Score out of Gemini training while remaining fully eligible for AI Overviews. This is optional and reversible; it is NOT a citation lever. Do **not** confuse it with blocking Googlebot (which would be catastrophic).
- **(d) Source:** GA6; GA1
- **(e) Severity:** **LOW** (optional data-governance choice) — but flagged because teams routinely and wrongly believe blocking Google-Extended hurts AI-Overviews visibility. It does not.

---

# PART B — BROADER AI-SEARCH LANDSCAPE (INDUSTRY / EMERGING — NOT GOOGLE POLICY)

> Everything below is industry research and operator (non-Google) documentation. Treat severities as visibility risk, not Google compliance. Quantified lifts come from the GEO paper (controlled 10k-query experiment, KDD 2024) and large-sample 2025-2026 citation studies; vendor-run figures are flagged.

## Sources read (operators + research)

| #    | Source                                                                     | URL                                                                                              |
| ---- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| IB1  | OpenAI bots (GPTBot / OAI-SearchBot / ChatGPT-User)                        | https://developers.openai.com/api/docs/bots                                                      |
| IB2  | Anthropic crawlers (ClaudeBot / Claude-User / Claude-SearchBot)            | https://support.claude.com/en/articles/8896518                                                   |
| IB3  | Perplexity bots (PerplexityBot / Perplexity-User)                          | https://docs.perplexity.ai/guides/bots                                                           |
| IB4  | Microsoft Copilot web access (bingbot grounding)                           | https://learn.microsoft.com/en-us/microsoft-365/copilot/manage-public-web-access                 |
| IB5  | GEO: Generative Engine Optimization (Aggarwal et al., KDD 2024)            | https://arxiv.org/html/2311.09735v3                                                              |
| IB6  | Ahrefs — does schema affect AI citations (1,885-page study)                | https://ahrefs.com/blog/schema-ai-citations/                                                     |
| IB7  | Search Engine Land — AI citations favor listicles/articles (1M+ citations) | https://searchengineland.com/ai-citations-favor-listicles-articles-product-pages-study-472364    |
| IB8  | Stacker × Scrunch — earned-media distribution +239% citations              | https://www.globenewswire.com/news-release/2026/03/16/3256365/0/en/                              |
| IB9  | Seer — AI brand visibility & content recency                               | https://www.seerinteractive.com/insights/study-ai-brand-visibility-and-content-recency           |
| IB10 | Profound — AI platform citation patterns (680M citations)                  | https://www.tryprofound.com/blog/ai-platform-citation-patterns                                   |
| IB11 | llms.txt proposal (Answer.AI, Jeremy Howard)                               | https://www.answer.ai/posts/2024-09-03-llmstxt.html                                              |
| IB12 | Mueller/Google dismissal of llms.txt                                       | https://www.searchenginejournal.com/google-says-llms-txt-comparable-to-keywords-meta-tag/544804/ |
| IB13 | Cloudflare/Wired — Perplexity stealth-crawling controversy                 | https://tech.slashdot.org/story/25/08/04/1459240                                                 |

---

## SECTION B1 — THE AI-CRAWLER ALLOW/BLOCK MATRIX (the mechanical gate for off-Google citation)

### B1.0 — The crawler matrix: which bots must be ALLOWED to be CITED

> "Must-allow-to-be-cited?" = does blocking this bot remove your site from being **cited/surfaced** (not merely trained on) in that platform's AI search? Verbatim quotes from each operator's live doc.

| User-agent           | Operator   | Controls                                                                                                                                                            | Must allow to be CITED?                         | Source |
| -------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------ |
| **GPTBot**           | OpenAI     | Model **training** only — `"used to crawl content that may be used in training our generative AI foundation models"`                                                | **NO** (training opt-out; safe to block)        | IB1    |
| **OAI-SearchBot**    | OpenAI     | **ChatGPT Search surfacing/citation** — `"used to surface websites in search results in ChatGPT's search features"`                                                 | **YES**                                         | IB1    |
| **ChatGPT-User**     | OpenAI     | **User-triggered live fetch** when a user's ChatGPT query browses a page                                                                                            | **YES**                                         | IB1    |
| **ClaudeBot**        | Anthropic  | Model **training** only — `"collecting web content"` to improve models                                                                                              | **NO** (training opt-out; safe to block)        | IB2    |
| **Claude-User**      | Anthropic  | **User-initiated live fetch** — blocking `"prevents our system from retrieving your content in response to a user query, which may reduce your site's visibility"`  | **YES**                                         | IB2    |
| **Claude-SearchBot** | Anthropic  | **Search indexing** — blocking `"prevents our system from indexing your content for search optimization, which may reduce your site's visibility"`                  | **YES**                                         | IB2    |
| **PerplexityBot**    | Perplexity | **Search indexing/citation** — `"Designed to surface and link websites in search results on Perplexity. It is not used to crawl content for AI foundation models."` | **YES**                                         | IB3    |
| **Perplexity-User**  | Perplexity | **User-triggered fetch** — `"generally ignores robots.txt"` (see B1.2 controversy)                                                                                  | **YES** (largely uncontrollable via robots.txt) | IB3    |
| **Google-Extended**  | Google     | Gemini/Vertex **training** opt-out token only — no Search/AI-Overviews impact                                                                                       | **NO** (see G6)                                 | GA6    |
| **Googlebot**        | Google     | Search index **+ grounds AI Overviews / AI Mode**                                                                                                                   | **YES**                                         | GA1    |
| **bingbot**          | Microsoft  | Bing index **+ grounds Copilot retrieval**                                                                                                                          | **YES**                                         | IB4    |

### B1.1 — The training-vs-citation TRAP (the #1 self-inflicted GEO wound)

- **(a) Rule:** Training and citation are governed by **different bots from the same operator.** You may block the training crawler to opt out of model training with **zero citation cost** — but only if you keep the operator's search/retrieval bot allowed. Never use a blanket `User-agent: * Disallow: /`, and never paste an "AI-bot blocklist" from a blog that lumps the search bots in with the training bots.
- **(b) WHY:** Exact pairings — block to opt out of training (citation-safe) vs must keep allowed to stay cited:
  - **OpenAI / ChatGPT Search:** block `GPTBot` → keep `OAI-SearchBot` **and** `ChatGPT-User` allowed (two-bot dependency: SearchBot decides _whether_ you're surfaced; ChatGPT-User does the _live fetch_ in-session).
  - **Anthropic / Claude:** block `ClaudeBot` → keep `Claude-SearchBot` **and** `Claude-User` allowed.
  - **Perplexity:** no training crawler exists (PerplexityBot is explicitly _not_ for training) → never blanket-block Perplexity; keep `PerplexityBot` allowed.
  - **Google:** `Disallow: Google-Extended` opts out of Gemini training → `Googlebot` stays allowed = AI Overviews eligibility (G6).
  - **Microsoft:** keep `bingbot` allowed = Copilot grounding eligibility.
- **(c) HOW (PropertyIQ):** See B1.3 for the exact current-config assessment and recommended `robots.ts` rewrite.
- **(d) Source:** IB1; IB2; IB3; IB4; GA6
- **(e) Severity:** **CRITICAL** — a careless wildcard disallow or copied AI-blocklist silently zeroes citation across ChatGPT, Claude, and Perplexity at once.

### B1.2 — Perplexity controversy (footnote for the rubric)

- **(a) Rule:** Robots.txt is **not a reliable control for Perplexity** in either direction. `Perplexity-User` "generally ignores robots.txt," and Perplexity has been credibly accused of stealth crawling.
- **(b) WHY:** Cloudflare (Aug 2025, `"Perplexity is using stealth, undeclared crawlers to evade website no-crawl directives"`) and Wired (2024) documented Perplexity rotating to a spoofed generic Chrome user-agent and changing ASNs/IPs to bypass robots.txt/WAF blocks; Cloudflare de-listed it from Verified Bots. Perplexity disputes the attribution. (IB13)
- **(c) HOW (PropertyIQ):** Keep `PerplexityBot` explicitly allowed (PropertyIQ _wants_ Perplexity citation). Do not rely on robots.txt to _block_ Perplexity if that ever became the goal — it would require WAF/Cloudflare-level controls. For citation, no action needed beyond "allowed."
- **(d) Source:** IB3; IB13
- **(e) Severity:** **LOW** (informational) — PropertyIQ wants the citation, so the controversy is a non-issue here; documented so no one wastes time trying to fine-tune Perplexity via robots.txt.

### B1.3 — ★ CRITICAL ASSESSMENT: PropertyIQ's current `robots.ts` ★

**Current config (`packages/frontend/app/robots.ts`):** four rule blocks — `*`, `GPTBot`, `ClaudeBot`, `PerplexityBot` — all `allow: ["/", "/api/og"]`, all `disallow: ["/api/", "/admin/", "/auth/", "/account/"]` (the `*` block adds `/dev/`, `/health/`, `/betatest/`). Sitemap declared. No `OAI-SearchBot`, `ChatGPT-User`, `Claude-User`, `Claude-SearchBot`, `Googlebot`, `bingbot`, or `Google-Extended` named.

**Verdict: functionally OK today, but confused and fragile. It explicitly names the wrong bots and relies on the wildcard for the ones that actually matter for citation.**

- **What is RIGHT:** Every citation bot is **currently allowed**, because any user-agent not explicitly listed falls under the `*` rule, which allows `/` and blocks only private paths. So `OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`, `Claude-User`, `Googlebot`, and `bingbot` can all reach `/markets/...`. Citation surfaces are open. Blocking `/api/` is correct (raw JSON endpoints aren't citable content), and explicitly allowing `/api/og` for OG images is a nice touch.
- **What is MISLEADING / fragile:**
  1. The config names `GPTBot`, `ClaudeBot`, `PerplexityBot` and _allows_ them — but `GPTBot` and `ClaudeBot` are **training** crawlers (B1.0). Allowing them is a _training_ decision, not a citation one. The bots that actually decide ChatGPT/Claude **citation** (`OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`, `Claude-User`) are **not named** — they only work because of the wildcard. The file reads as if someone optimized for citation but actually configured training access.
  2. **Fragility:** the day anyone adds a defensive "block AI training" rule (e.g. `GPTBot: Disallow /`, or worse a broad AI-blocklist), they will likely leave `OAI-SearchBot`/`Claude-SearchBot` unspecified or accidentally caught, and citation breaks silently. The current structure invites exactly the B1.1 trap.
- **RECOMMENDATION (make the intent explicit and trap-proof):** Rewrite `robots.ts` so the **citation/search bots are named and explicitly allowed**, and (optionally) the **training bots are an explicit, deliberate decision** — not an accident of the wildcard. Concretely:
  - **Explicitly ALLOW** (named, `allow: ["/", "/api/og"]`, `disallow` private paths): `OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`, `Claude-User`, `PerplexityBot`, `Perplexity-User`, `Googlebot`, `bingbot`. These are the citation surfaces — naming them documents intent and guards against future edits.
  - **DECIDE deliberately on training bots** `GPTBot`, `ClaudeBot`: keep allowed (current default = data may be used for model training) OR `Disallow: /` to opt out of training. **Either choice is citation-safe** because the search bots above are independently allowed. For a data product, a reasonable stance is to **allow citation bots, block training bots** (`GPTBot`/`ClaudeBot` `Disallow: /`) to keep proprietary scores out of foundation-model training while staying fully citable — mirroring the `Google-Extended` decision in G6.
  - **OPTIONAL `Google-Extended: Disallow /`** — opts out of Gemini/Vertex training with **zero** Search/AI-Overviews cost (G6).
  - Keep the wildcard `*` as the catch-all (allow `/`, block private paths) so unknown future bots default to "can read public pages."
- **(d) Source:** IB1; IB2; IB3; IB4; GA1; GA6
- **(e) Severity:** **HIGH** — today citation works by luck of the wildcard; the fix converts an implicit, fragile config into an explicit, trap-proof one and is the single highest-value robots change. (Not CRITICAL only because nothing is _currently_ broken.)

---

## SECTION B2 — llms.txt

## I-LLMS — llms.txt is a LOW-COST EXPERIMENT, not a Google requirement and not a confirmed citation lever

- **(a) Rule:** You may ship `/llms.txt` as a cheap experiment, but do **not** treat it as a citation or ranking lever. No major AI engine has confirmed using it.
- **(b) WHY (honest verdict):** `/llms.txt` is a proposed standard published **Sept 3, 2024 by Jeremy Howard (Answer.AI)** — a root-level markdown file giving LLMs `"brief background information and guidance, along with links to ... more detailed information"` (IB11). The original proposal claims **no** AI-company commitment. As of 2025-2026, **none of Google, OpenAI, Anthropic, Microsoft, or Perplexity has officially committed** to reading it for ranking or citation. Google is explicitly dismissive — John Mueller (verbatim): `"AFAIK none of the AI services have said they're using LLMs.TXT (and you can tell when you look at your server logs that they don't even check for it). To me, it's comparable to the keywords meta tag"` (IB12). Adoption is **publisher-side only** (sites _publish_ the file; crawlers don't consume it for citation). Google has even suggested `noindex`-ing the file itself.
- **(c) HOW (PropertyIQ):** Optional. If shipped, generate a `/llms.txt` listing the high-value hubs (top markets, methodology, scores) with one-line descriptions and links — it costs little and _may_ aid dev-tool/agent ingestion. **But spend zero effort expecting ChatGPT/Perplexity citation from it.** The real citation levers are B1 (allow the search bots) + B3 (citable facts). Do not prioritize llms.txt over either.
- **(d) Source:** IB11; IB12
- **(e) Severity:** **LOW** — cheap, possibly-useful, unproven. Build it only after B1 and B3 are done.

---

## SECTION B3 — THE CITABLE-FACTS PLAYBOOK (what actually drives AI citations)

> The headline research finding: in a controlled 10,000-query experiment (IB5), the three highest-impact on-page tactics — **adding statistics, citing sources, adding quotations** — delivered a **30-40% relative lift** in generative-engine visibility, and the **only tactic that hurt was keyword stuffing (−8 to −9%)**. A data-dense page is the ideal substrate; the job is to expose facts as clean, dated, sourced, self-contained passages.

### I1 — Specific statistics in clear declarative sentences (one stat = one sentence = one citable unit)

- **(a) Rule:** Render every metric as its own declarative sentence naming the entity, value, and date: "The median home price in Austin, TX was $487,000 in May 2026."
- **(b) WHY:** GEO paper "Statistics Addition" scored **+32-34%** on the visibility metric (the #2 of nine tactics tested) and **+23%** on subjective impression (IB5). AI retrieval extracts self-contained factual sentences; a number trapped only in a chart tooltip or image is not extractable.
- **(c) HOW (PropertyIQ):** In `MarketStatsBlock` / `MetroPageContent`, ensure each headline metric (median price, rent, days-on-market, YoY, PropertyIQ Score) is emitted as a full visible sentence with the number inline and the place named — not only as a styled stat card or chart. The data is already on the page; the change is sentence form, not new data.
- **(d) Source:** IB5
- **(e) Severity:** **HIGH** — highest-proven, lowest-effort lever for a data site.

### I2 — Name your data sources next to every stat (citable sourcing levels the playing field)

- **(a) Rule:** Attribute every stat to a named source with a date in **visible text** ("Source: Zillow ZHVI, May 2026"), and maintain a methodology page linking primary datasets.
- **(b) WHY:** GEO paper "Cite Sources" scored **+28-29%** overall, was strongest for **factual queries**, and most strikingly gave a **+115% visibility gain for low-authority (rank-5) sites** while reducing the top site's share — the "GEO levels the playing field" result that maps directly to long-tail location pages not ranking #1 in classic SERPs (IB5). Original proprietary data (the PropertyIQ Score, forecasts) is a moat: if you publish a number no one else has, engines have no alternative source to cite.
- **(c) HOW (PropertyIQ):** Add a per-stat visible attribution line (Zillow, Realtor.com, Census, BLS, FRED — PropertyIQ already uses these); keep a canonical `/scores/methodology` page naming every source with outbound links and the score formula; add an analyst/credential block. The `Dataset` schema already has `creator`/`license`; mirror the source names in visible HTML (G3).
- **(d) Source:** IB5
- **(e) Severity:** **HIGH** — strongest factual-query lever and disproportionately helps long-tail pages.

### I3 — Self-contained ~50-150 word passages, each naming the place (chunk-level extractability)

- **(a) Rule:** Write each metric section as a self-contained ~50-150 word passage that names the city/ZIP and date inline and makes sense pulled out of all surrounding context. Never "this market" — always "Austin, TX."
- **(b) WHY:** AI engines don't retrieve whole pages; a RAG pipeline splits pages into passages, embeds each, and matches/reranks (Perplexity reportedly keeps only the top ~30% above threshold). A passage that needs surrounding context has high extraction cost and gets dropped. Restructuring into clean self-contained chunks is reported to yield 2-4× citation-rate improvements; this is the AI-era extension of Google's 2021 passage ranking. (IB5; secondary RAG-mechanism reporting.)
- **(c) HOW (PropertyIQ):** Give each metric its own headed ~50-150 word section that names the place and date and stands alone; avoid pronouns that depend on a prior paragraph. Don't bundle six metrics into one 800-word block — that single chunk dilutes relevance for any one query.
- **(d) Source:** IB5
- **(e) Severity:** **HIGH** — determines whether your facts survive the retrieval/rerank step at all.

### I4 — Question headings + answer-first (BLUF) + real tables/lists

- **(a) Rule:** H2/H3 = the literal user question ("What is the median home price in Austin, TX?"); the first sentence below = the direct answer in a 40-60 word block. Render core metrics as real HTML `<table>` and lists.
- **(b) WHY:** ~90% of top AI citations have the answer within the first 100 words; the 40-60 word paragraph is the snippet sweet spot (<30 reads incomplete, >70-80 gets truncated). A 1M+-citation study found listicles/articles/product pages drive **over half (52%)** of AI mentions, with listicles alone at **21.9%**; tables/lists also form natural chunk boundaries (IB7). (Some per-format lift figures are vendor/second-tier — flag if load-bearing.)
- **(c) HOW (PropertyIQ):** Add a Q&A block per page answering the literal queries ("What is the median home price in X?", "What is the average rent in X?", "What is X's market score?"), answer-first; keep a real `<table>` (Metric | Value | As-of date | Source) and a key-takeaways bullet list. Add `FAQPage`/`QAPage` schema mirrored in visible text (note: FAQ rich results were curtailed by Google in 2023, but the markup still aids extraction — and per G3 it must match visible content).
- **(d) Source:** IB5; IB7
- **(e) Severity:** **HIGH** — format is a strong, well-evidenced citation signal.

### I5 — Schema markup: a SUPPORTING entity/indexing signal, debated as a direct citation driver

- **(a) Rule:** Keep schema (`Dataset`, `Article`/`Place`, `FAQPage`/`QAPage`, `BreadcrumbList`) for entity resolution and Search rich results — but do **not** rely on it for AI citation, and always mirror it in visible HTML.
- **(b) WHY:** Industry evidence is mixed-to-negative on _direct_ AI-citation lift. Ahrefs (1,885 pages adding JSON-LD vs 4,000 controls) found AI Overviews **−4.6%** (small but significant decline), AI Mode +2.4% and ChatGPT +2.2% (both statistically indistinguishable from zero); retrieval tests found AI systems extracted only **visible HTML**, ignoring JSON-LD/Microdata at retrieval time (IB6). Schema still helps indirectly: rich results, knowledge graph, and entity recognition (which feed I6). This aligns with Google's own framing in G3 (schema not required, must match visible text).
- **(c) HOW (PropertyIQ):** Keep `Dataset` (`creator`, `temporalCoverage`/`observationDate`, `variableMeasured`) + `BreadcrumbList` (geography hierarchy Country → State → Metro → County → ZIP). Add `FAQPage`/`QAPage` for the I4 Q&A blocks. The non-negotiable: every schema fact also appears as visible text, because that's what AI reads at retrieval.
- **(d) Source:** IB6; GA1; GA2
- **(e) Severity:** **MEDIUM** — worth keeping for Search + entity support; not a primary citation lever, so don't over-invest expecting AI lift.

### I6 — Up-to-date data with explicit "as of [date]" stamps + dateModified

- **(a) Rule:** Stamp "as of [Month Year]" next to every stat in visible text, set `dateModified` in schema, and regenerate pages on each data refresh.
- **(b) WHY:** AI-cited content skews strongly fresh — ~65% of AI bot hits target content from the past year, 89% from the last three (Seer, 5,000+ URLs); Perplexity ~50% and Google AI Overviews ~44% of citations are current-year (IB9). Perplexity/Gemini/ChatGPT-with-browsing read "last updated" signals and weight recency.
- **(c) HOW (PropertyIQ):** Inline "as of May 2026" next to each visible metric; keep `dateModified`/`datePublished` in schema; trigger page regeneration on each monthly data import so the visible date AND the schema date advance together. PropertyIQ already revalidates ISR every 24h and stamps "Updated 2026" — extend that to a precise month stamp per stat. **Caveat:** update the actual data; a stale page with a freshened date is a trust risk (G4).
- **(d) Source:** IB9
- **(e) Severity:** **HIGH** — recency is a strong cross-platform citation bias, and PropertyIQ's monthly pipeline is a natural advantage.

### I7 — Third-party mentions / earned media (the off-page multiplier — biggest single off-page lever)

- **(a) Rule:** Get PropertyIQ's data named and quoted on sites AI engines already trust; syndicate the **same** data study across multiple third-party publishers; unlinked mentions still count.
- **(b) WHY:** Multi-publisher distribution roughly **triples** citations — Stacker × Scrunch (87 stories, 2,600+ prompts, 8 platforms) found a **median +239%** lift vs owned content, with **64% of AI citations coming from third-party publisher sources** (IB8). Community/reference sources dominate AI grounding: Reddit is Perplexity's and AI Overviews' #1 source; Wikipedia is ChatGPT's #1 (IB10). Brand mentions correlate with AI visibility far more strongly than backlinks ("mentions are the new links").
- **(c) HOW (PropertyIQ):** Run quarterly proprietary data studies ("Top 50 cash-flow metros, Q2 2026") and syndicate the _same_ study across real-estate/news publishers; pitch journalists so "according to PropertyIQ" appears even unlinked; get into "best real-estate analytics tools" roundups (the listicles AI pulls for tool queries); be genuinely, transparently active on Reddit (r/realestate, r/realestateinvesting) — no astroturfing.
- **(d) Source:** IB8; IB10
- **(e) Severity:** **HIGH** — the largest off-page citation multiplier; complements on-page facts.

### I8 — Entity consistency / brand + knowledge graph (citation eligibility for "who is this source")

- **(a) Rule:** Use one canonical brand string everywhere ("PropertyIQ", never "Property IQ"); ship site-wide `Organization` schema with a `sameAs` array; create a Wikidata item; keep an unambiguous About/methodology entity home.
- **(b) WHY:** LLMs disproportionately ground in entity-rich reference sources, and Knowledge-Graph presence is becoming a _prerequisite_ for confident citation (the engine must resolve who the source is). Brand mentions correlate ~3× more strongly with AI visibility than backlinks (vendor data, IB10). Wikipedia/Wikidata feed Google's Knowledge Graph.
- **(c) HOW (PropertyIQ):** One brand string sitewide; `Organization` JSON-LD with `sameAs` (LinkedIn, Crunchbase, social); **create a Wikidata item now** (no notability bar, feeds the Knowledge Graph); pursue Wikipedia only once I7 press coverage establishes notability.
- **(d) Source:** IB10
- **(e) Severity:** **MEDIUM** — increasingly gates citation eligibility; Wikidata item is a cheap, high-leverage start.

### I9 — Fluency + quotations; NEVER keyword-stuff or homogenize 33k pages

- **(a) Rule:** Write fluent, clear, one-idea declarative sentences; embed short attributed quotations; never keyword-stuff; do not flatten 33k pages into identical boilerplate.
- **(b) WHY:** GEO paper per-method lifts: Quotation Addition **+41-43%** (highest single tactic), Fluency Optimization **+28-30%** — and **Keyword Stuffing −8 to −9% (the only tactic that hurt)** (IB5). Thin near-duplicate templates get consolidated by AI, not cited; and at scale they risk Google's scaled-content-abuse policy (G5).
- **(c) HOW (PropertyIQ):** Rewrite auto-generated metric prose into short natural sentences while **preserving each market's distinctive vocabulary** (don't homogenize); embed short attributed quotes (a Zillow/Realtor methodology note, a local analyst, Census/FRED definitions); resist mass-injecting "best real estate market in {city}" variants — it actively lowers citation odds.
- **(d) Source:** IB5
- **(e) Severity:** **MEDIUM** (HIGH for the anti-pattern) — quotations are a top lever; keyword stuffing is the one proven way to _lose_ citations.

---

## CITABLE-FACTS PLAYBOOK FOR A 33,000-PAGE DATA SITE (ordered checklist)

**Per location page (proven-impact order):**

1. One declarative stat sentence per metric, entity + value + date inline (I1).
2. Question-phrased H2 + answer-first 40-60 word paragraph, answer in first 100 words (I4).
3. A real HTML table (Metric | Value | As-of date | Source) + key-takeaways bullet list (I4).
4. Per-stat visible source attribution: "Source: Zillow ZHVI, May 2026" (I2).
5. "As of [Month Year]" stamps + `dateModified`, refreshed on every monthly import (I6).
6. Self-contained ~50-150 word chunks, each naming the place — no pronouns relying on prior text (I3).
7. Q&A blocks answering the literal queries, with FAQPage/QAPage schema mirrored in visible HTML (I4).
8. Schema layer: Dataset + Article/Place + BreadcrumbList — entity/indexing support, mirrored in HTML (I5, G3).

**Scale guardrails (33k assets vs 33k liabilities):** 9. Maximize unique declarative facts per page (this city's numbers, YoY, rank vs state/nation, market-specific narrative) (G5, I9). 10. Never keyword-stuff templated variants — the one proven citation-killer (I9). 11. Eligibility gating — don't publish pages for data-sparse regions; consolidate into richer hubs (G2, G5). 12. Don't homogenize fluency across 33k pages — improve readability, preserve distinctive vocabulary (I9).

**Off-page multiplier:** 13. Quarterly proprietary data studies syndicated across multiple publishers (median +239%; 64% of citations are third-party) (I7). 14. Create a Wikidata item + Organization `sameAs`; keep brand naming identical everywhere (I8). 15. Earn "according to PropertyIQ" mentions in news/industry articles and "best tools" roundups; be transparently active on Reddit (I7).

---

# SUMMARY (verdict)

**Google's actual AI-features stance (authoritative):** There is no "AI SEO." Google says verbatim `"There are no additional requirements to appear in AI Overviews or AI Mode, nor other special optimizations necessary"` and `"no special schema.org structured data that you need to add."` AI Overviews / AI Mode run on the regular Search index, so eligibility = **indexed + crawlable by Googlebot + snippet-eligible** — Clusters 1 and 4 ARE the AI-Overviews strategy. AI-generated content is fine because Google rewards quality `"however content is produced"`, unless it's scaled manipulation. Structured data is hygiene that must match visible text, not a promised AI booster. **Blocking Google-Extended does NOT affect Search ranking or AI Overviews** — it only opts out of Gemini/Vertex training (`"does not impact a site's inclusion in Google Search nor is it used as a ranking signal"`).

**AI-crawler allow/block matrix for citation (off-Google):** Training and citation are different bots. **Safe to block (training opt-out):** GPTBot, ClaudeBot, Google-Extended. **MUST keep allowed to be CITED:** OAI-SearchBot + ChatGPT-User (ChatGPT), Claude-SearchBot + Claude-User (Claude), PerplexityBot (Perplexity), Googlebot (AI Overviews), bingbot (Copilot). The trap: a wildcard `Disallow: /` or a copied AI-blocklist kills citation everywhere at once.

**PropertyIQ robots.txt verdict:** Functionally OK today (citation bots reach `/` via the wildcard, `/api/` correctly blocked) but **confused and fragile** — it explicitly names the _training_ bots (GPTBot/ClaudeBot) and allows them, while the bots that actually drive citation (OAI-SearchBot, Claude-SearchBot, ChatGPT-User, Claude-User, Googlebot, bingbot) are unnamed and work only by luck of the wildcard. **Fix (HIGH):** explicitly name and allow the citation/search bots, make the training-bot decision deliberate (reasonable: block GPTBot/ClaudeBot + Google-Extended to keep proprietary scores out of training while staying fully citable), keep the wildcard catch-all.

**Citable-facts playbook for the data site:** PropertyIQ's dense, dated numbers are the ideal substrate. Top levers (controlled-experiment grade): one declarative stat sentence per metric (+32-34%), name your sources per stat (+28%, +115% for long-tail pages), self-contained 50-150 word chunks, answer-first question headings, "as of [date]" + monthly refresh, and short attributed quotations (+41-43%). Never keyword-stuff (−8-9%, the only proven citation-killer). Biggest off-page lever: syndicate quarterly proprietary data studies across publishers (median +239%). **llms.txt is a low-cost experiment, not a Google requirement and not a confirmed citation lever** — no major engine has committed to it (Mueller: `"comparable to the keywords meta tag"`).

**File:** `D:\projects\rei-platform\docs\seo\google-rubric\08-ai-generative-seo.md`

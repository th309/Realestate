# Entity Disambiguation Playbook — PropertyIQ (propertyiq.app)

Status as of 2026-07-08. Companion to `GEO-ANALYSIS.md` §5 (brand mentions are the weakest GEO dimension; the "PropertyIQ" name is contested by propertyiq.com.au, property-iq.ai, propertyiq.com).

## 1. Google Search Console — ✅ DONE (2026-07-08)

Priority recrawl requested for all six updated pages (post-release, verified serving new content first):
`/`, `/about`, `/scores`, `/map`, `/markets`, `/pricing` — each confirmed "URL was added to a priority crawl queue."

Expect stale snippets ("925 metros", "0.37 IC", "$29 Pro") to wash out of Google within days. Re-check in ~1 week: `site:propertyiq.app` and query the old strings.

## 2. Facebook vanity URL — ✅ DONE (2026-07-09)

- Page username saved: **`propertyiq.us`** → https://www.facebook.com/propertyiq.us (verified resolving).
- `OrganizationJsonLd.tsx` sameAs updated to the vanity URL.
- Rejected/unavailable: `propertyiq-app` (hyphens invalid on FB), `propertyiq.app`/`propertyiqapp` (taken), `getpropertyiq` (taken). Available but not chosen: `PropertyIQHQ`, `trypropertyiq`, `propertyiqscores`.

## 3. Wikidata item — ✅ DONE (2026-07-09): **Q140473066**

https://www.wikidata.org/wiki/Q140473066 — created under the "PropertyIQ" Wikimedia account (VPN off; NordVPN's Clouvider ranges are Wikimedia-blocked until 2027, so future edits also need VPN off). First PropertyIQ entity on Wikidata — we define the name.

Live statements (via UI + Action API `wbcreateclaim`/`wbsetreference`): instance of = web application + business; official website; industry = real estate industry; inception = 2024; country = US (all five referenced to /about + retrieved date); language = English; described at URL = /scores/methodology; official blog URL = /blog; Facebook username = propertyiq.us; LinkedIn = propertyiq-app; Reddit = propertyiq-app; YouTube handle = PropertyIQ_app. sameAs in OrganizationJsonLd.tsx now leads with the Q-id URL.

Remaining nice-to-haves: logo image (requires Wikimedia Commons upload + CC license decision — Troy's call); "different from" statements if/when the AU (propertyiq.com.au) or Las Vegas (propertyiq.com) companies get Wikidata items; confirm the account's email address (banner pending) for recovery.

Once you're logged in (VPN off), I can drive the browser through this, or you can paste it yourself at `Special:NewItem`:

| Field            | Value                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| Label (en)       | PropertyIQ                                                                                                         |
| Description (en) | US real estate market analytics platform ranking metros, counties, and ZIP codes with a validated predictive score |
| Aliases          | PropertyIQ.app, PIQ                                                                                                |

Statements:

| Property                | Value                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| instance of (P31)       | web application (Q189210) — add business (Q4830453) as second value                                                              |
| official website (P856) | https://www.propertyiq.app (mark preferred rank)                                                                                 |
| industry (P452)         | real estate (Q11401)                                                                                                             |
| inception (P571)        | 2024                                                                                                                             |
| country (P17)           | United States of America (Q30)                                                                                                   |
| different from (P1889)  | any existing items for other "PropertyIQ" companies (search propertyiq.com.au's parent, property-iq.ai) — add if/when they exist |
| described at URL (P973) | https://www.propertyiq.app/about                                                                                                 |

Notability note: Wikidata's bar is "clearly identifiable entity + serious publicly available references." The LinkedIn company page and press/data citations help; link them as references on statements if challenged. (Do NOT use the App Store app id6762011177 as a reference — it is a competing product, not ours.)

## 4. Reddit — 🟡 ACCOUNT LIVE, WARM-UP PHASE (no posts yet)

**Status (2026-07-09):** `u/propertyiq-app` created by Troy; profile set up (display name "PropertyIQ", transparency bio, propertyiq.app link). Avatar still default — drag `packages/frontend/public/logo.png` onto Settings → Profile → Avatar. NO POSTS until Troy green-lights (explicit instruction); warm-up guidance below still applies.

**Original findings (2026-07-08):**

- `u/PropertyIQ` — **banned account** (name permanently burned)
- `u/PropertyIQ_app` — **banned account** (same handle as our YouTube — burned on Reddit)
- The new `u/propertyiq-app` is one hyphen away from a banned handle — if that ban was PropertyIQ-related, ban-evasion detection remains a live risk; keep behavior strictly compliant (90/10, disclosure, no link-drops).

**Why this matters:** if either banned account was a previous PropertyIQ marketing attempt, registering a new brand handle looks like **ban evasion** — Reddit's automated detection can permanently suspend the new account AND sitewide-spam-filter the `propertyiq.app` domain. A domain filter would destroy the Perplexity citation channel (Reddit ≈ 46.7% of Perplexity's citations) — strictly worse than having no Reddit presence.

**Decision needed (Troy):** were those banned accounts yours/past contractors'?

- If YES → do NOT create u/PropertyIQHQ. Appeal the ban via reddit.com/appeals first, or operate solely through the personal account below.
- If NO (squatters/coincidence) → u/PropertyIQHQ is safe to register manually (account creation is a you-step), but still follow the participation rules below.

**Compliant strategy (either way) — founder voice beats brand voice on Reddit:**

1. Use the personal account. Set a public flair/bio line: "Founder of PropertyIQ (propertyiq.app)". Transparency converts; stealth gets banned.
2. Follow the 90/10 rule (Reddit's own self-promotion guideline): 9 genuinely helpful, no-link contributions for every 1 mention of your product.
3. Where to contribute value: r/realestateinvesting, r/RealEstate, r/FirstTimeHomeBuyer daily threads — answer "which market" questions WITH DATA (score, DOM, price cuts, YoY) and NO link unless asked. The data itself builds the brand association.
4. Where links are allowed: r/SideProject, r/roastmystartup, r/dataisbeautiful (an original monthly market-heat visualization with methodology in comments is exactly what that sub rewards and exactly what AI engines cite).

**Communities joined by u/propertyiq-app (2026-07-09), by audience:**

| Audience        | Subreddits                                       | Promo tolerance                                                                                                              |
| --------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Launch venues   | r/SideProject, r/dataisbeautiful                 | Links OK (SideProject: self-promo allowed; DIB: OC visualizations + source in comments)                                      |
| Investors       | r/realestateinvesting, r/airbnb_hosts (STR)      | Data-only comments; NO links unless asked                                                                                    |
| Agents/brokers  | r/realtors, r/RealEstate, r/CommercialRealEstate | STRICTLY no promo — data-only; r/realtors bans vendor pitching                                                               |
| Buyers          | r/FirstTimeHomeBuyer                             | Data-only, be extra consumer-friendly                                                                                        |
| Landlords/PMs   | r/Landlord, r/PropertyManagement                 | Data-only                                                                                                                    |
| Developers/land | r/RealEstateDevelopment, r/Landdevelopment       | Data-only; land-level data is thinner in PIQ — county metrics are the hook                                                   |
| Market watchers | r/REBubble                                       | High volume, loves charts/data, actively hostile to promo — best karma farm for pure-data comments, worst place for any link |

(r/HousingMarket does not exist — skipped.) 5. Never post the same content to multiple subs in one day; never use vote manipulation; disclose affiliation every time.

**Draft post (r/SideProject or r/roastmystartup — founder-voice, edit to taste):**

> **I built a free tool that scores every US housing market (metro/county/ZIP) on demand momentum — roast the methodology**
>
> Founder here, so all bias disclaimed. PropertyIQ (propertyiq.app) reduces four monthly signals — Zillow price momentum (12-mo + 3-mo), Realtor.com days-on-market, and price-cut share — into a 1–99 score where 50 = your state's average. No ML black box; the formula is published, equal-weight, and backtested out-of-sample on 2001–2023 vintages (methodology page has the full validation report, permutation tests included).
>
> What I'd love roasted: the score-band calibration, the state-relative framing, and whether the FAQ answers on market pages actually answer what buyers ask. Free tier covers all metro data, no signup needed for the map.

**Draft comment pattern (data-first, no link):**

> Looking at [Metro]'s current numbers: median DOM is X days (up/down from Y a year ago), Z% of listings have price cuts, and 12-mo price momentum is W%. That combination usually reads as [cooling/firming] demand — the market's momentum score is [N] vs a state-average of 50. Happy to share where that data comes from if useful.

## 5. Remaining sameAs graph (after the above)

Target end-state for `OrganizationJsonLd.tsx`:

- LinkedIn `/company/propertyiq-app/` ✅ (live)
- YouTube `@PropertyIQ_app` ✅ (live)
- Facebook `/propertyiq.us` ✅ (live)
- Reddit `/user/propertyiq-app/` ✅ (live in sameAs; account created, not yet posting)
- Wikidata item URL `Q140473066` ✅ (live — strongest entity signal of all)
- App Store — DO NOT ADD: `apps.apple.com/us/app/propertyiq/id6762011177` is a COMPETING product, not ours (was added to sameAs 2026-07-11, removed same day). Never link/cite it.
- Crunchbase — add after profile is created; copy-paste draft ready at `docs/marketing/crunchbase-profile-draft.md`

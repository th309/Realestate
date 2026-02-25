---
name: suggest-blog-posts
description: Suggest and draft SEO-optimized blog posts for PropertyIQ
---

# Blog Post Suggestion & Drafting

## Suggest Mode

When the user asks to suggest blog posts:

1. Read `packages/frontend/content/blog/keyword-tracker.md` to see covered keywords
2. Review the keyword opportunity table from the SEO audit (in `docs/plans/2026-02-25-full-seo-overhaul-design.md`)
3. Check what metro pages exist for cross-linking opportunities
4. Propose 3-5 post ideas with:
   - Title
   - Target keyword
   - Content outline (5-7 bullet points)
   - Why this keyword matters (search volume, competition)
   - Which metro pages to link to

## Draft Mode

When the user approves a post idea:

1. **REQUIRED: Fetch actual scores before writing.** Query the backend for real PropertyIQ scores for every metro you plan to mention:
   - Run: `curl -s "http://localhost:3001/api/scores/top?scoreType=homeready&geoLevel=metro&limit=50"` to get top-scoring metros
   - For specific metros: `curl -s "http://localhost:3001/api/scoring/metro/{cbsaCode}?scoreType=homeready"`
   - CBSA codes are in `packages/frontend/lib/data/metro-slug-data.ts`
   - **NEVER recommend a metro without checking its actual score first**
   - **NEVER recommend a metro with a HomeReady score below 60 as a "top market" or "good buy"**
   - Low-scoring metros (below 50) can only be mentioned as cautionary examples or markets to watch/avoid
2. **Verify all internal links resolve.** Every `/markets/[slug]` link must use a slug that exists in `packages/frontend/lib/data/metro-slug-data.ts`. Search the file to confirm before using any slug.
3. Write a complete MDX file with frontmatter
4. Save to `packages/frontend/content/blog/drafts/[slug].mdx`
5. Include:
   - Proper frontmatter (title, description, date, author: "PropertyIQ Research + AI", category, tags, targetKeyword)
   - 800-1500 words of substantive content
   - H2/H3 headings with keywords worked in naturally
   - Internal links to `/markets/[slug]` pages (verified in step 2)
   - Actual PropertyIQ scores cited as evidence (fetched in step 1)
   - Links to `/map`, `/scores`, `/data` features
   - CTA section at the end
6. Show the user a preview of the frontmatter and outline

## Publish Mode

When the user approves a draft:

1. Move from `content/blog/drafts/[slug].mdx` to `content/blog/[slug].mdx`
2. Update `content/blog/keyword-tracker.md` with the new entry
3. Commit the changes

## Score Alignment Rules (CRITICAL)

Blog content MUST align with PropertyIQ's own scoring data. Recommending metros that score poorly destroys credibility — users will read "Austin is great!" then visit the Austin page and see a 21/100.

- **Always fetch live scores before drafting.** Never rely on general real estate knowledge or industry hype about which markets are "hot."
- **Positive recommendations require HomeReady 60+.** Only recommend metros as "top markets," "best to buy," or "great investment" if their HomeReady score is 60 or above.
- **Low-scoring metros are cautionary examples.** Metros scoring below 50 (like Austin, Phoenix, Tampa, Nashville as of early 2026) should only appear as "markets to watch carefully," "markets facing headwinds," or "markets where the data says wait."
- **Cite actual scores as evidence.** Don't just say "Rochester is strong" — say "Rochester's HomeReady score of 98.9 (A+) makes it the top-ranked major metro."
- **The narrative is data over hype.** PropertyIQ's differentiator is following the data. Our scores often contradict industry hype (e.g., "boring" Northeast/Midwest markets outperform hyped Sun Belt markets). Lean into this.

## Content Guidelines

- Write for real estate investors, homebuyers, and agents
- Use PropertyIQ data and scores as evidence (fetched from the live backend, not guessed)
- Avoid fluff — every paragraph should provide value
- Front-load the primary keyword in the title and first paragraph
- Use the target keyword naturally 3-5 times in the body
- Include at least 3 internal links to PropertyIQ pages
- All `/markets/[slug]` links must be verified against `metro-slug-data.ts`
- Never use em dashes (---, —). Use commas, periods, colons, or parentheses instead
- End with a clear CTA

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

1. Write a complete MDX file with frontmatter
2. Save to `packages/frontend/content/blog/drafts/[slug].mdx`
3. Include:
   - Proper frontmatter (title, description, date, author, category, tags, targetKeyword)
   - 800-1500 words of substantive content
   - H2/H3 headings with keywords worked in naturally
   - Internal links to `/markets/[slug]` pages
   - Links to `/map`, `/scores`, `/data` features
   - CTA section at the end
4. Show the user a preview of the frontmatter and outline

## Publish Mode

When the user approves a draft:

1. Move from `content/blog/drafts/[slug].mdx` to `content/blog/[slug].mdx`
2. Update `content/blog/keyword-tracker.md` with the new entry
3. Commit the changes

## Content Guidelines

- Write for real estate investors, homebuyers, and agents
- Use PropertyIQ data and scores as evidence
- Avoid fluff — every paragraph should provide value
- Front-load the primary keyword in the title and first paragraph
- Use the target keyword naturally 3-5 times in the body
- Include at least 3 internal links to PropertyIQ pages
- End with a clear CTA

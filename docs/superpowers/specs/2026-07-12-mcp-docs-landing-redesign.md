# MCP Docs Landing Redesign

**Date:** 2026-07-12
**Status:** Approved (user-approved design in session; reference: creatify.ai/features/mcp)

## Goal

Replace the tabbed docs page at `/docs/mcp` with a clean, Creatify-style single-scroll
landing page that gets a real estate agent from "what is this" to "connected to Claude"
in one screenflow. Deep documentation moves behind a link.

## Audience

Real estate agents primarily (non-technical), then investors, brokerages, property
managers. The page must read like "add this to Claude," not API docs.

## Pages

### `/docs/mcp` — landing page (rewritten)

Single scroll, five sections, PropertyIQ M3 branding (semantic tokens only):

1. **Hero** — eyebrow `MCP INTEGRATION · 44 TOOLS` (Roboto Mono), H1 "Add PropertyIQ
   to Claude", agent-first subline, primary CTA "Connect now" (anchor to `#install`),
   secondary link "Browse all 44 tools →" (`/docs/mcp/reference`). Signature hero
   exchange: a serif prompt bubble ("Build a listing presentation for 78704…") with a
   data-chip response row (median value, days on market, score badge).
2. **Install — "Set up once"** (`#install`) — client picker as M3 filter chips
   (Claude.ai, Claude Code, Claude Desktop, Cursor, Windsurf, VS Code, Cline).
   Selected client renders a data-driven recipe: numbered steps, config snippet
   (from `SETUP_CONFIGS`, with live API-key substitution), client-specific gotcha
   tips, and the inline `GenerateApiKeyStep` for key-based clients. OAuth clients
   (Claude.ai, Cursor) show no key step. Footer note: any Streamable-HTTP client can
   connect to `https://mcp.propertyiq.app/mcp`.
3. **"Once connected — what you can ask for"** — featured full-width Agents card with
   three serif prompt bubbles (listing presentation, buyer consultation brief, monthly
   market update email) + three smaller persona cards (Investors, Brokerages & teams,
   Property managers), one prompt each. Quiet line linking core data tools to the
   reference page.
4. **FAQ** — `<details>` accordion, reusing `MCP_FAQ` verbatim.
5. **Closing CTA** — "Your next deal starts with a message" + prompt-bubble echo +
   Connect button + link to full docs.

A tiny client component redirects legacy hashes (`#tools`, `#examples`,
`#troubleshooting`) to `/docs/mcp/reference#<hash>`.

### `/docs/mcp/reference` — deep docs (new route)

Existing `ToolsReferenceTab`, `ExamplesTab`, `McpTroubleshootingTab` mounted unchanged
in the existing hash-synced tab shell (Setup tab removed; default tab `tools`).
Back-link to `/docs/mcp`.

## Design system notes

- Type signature: example prompts set in Source Serif 4 (`font-serif`) — the brand's
  editorial face — because prompts are speech to the AI, not UI chrome. All other UI
  in Roboto; URLs/counts/step numbers in Roboto Mono.
- Recurring signature element: the prompt bubble (shared `PromptBubble` component).
- M3: cards `rounded-xl`, buttons/chips per §8.4–8.5, surface-tone elevation,
  `duration-200/400` transitions, reduced-motion respected.

## File changes

| Action  | File                                                                                                                                                                                          |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rewrite | `app/(app)/docs/mcp/page.tsx` (composes landing sections)                                                                                                                                     |
| New     | `components/landing/McpHero.tsx`, `PromptBubble.tsx`, `InstallSection.tsx`, `install-recipes.tsx`, `CapabilitiesSection.tsx`, `McpFaqSection.tsx`, `ClosingCta.tsx`, `LegacyHashRedirect.tsx` |
| New     | `reference/page.tsx`, `components/McpReferenceClient.tsx`                                                                                                                                     |
| Update  | `components/mcp-docs-data.ts` (`MCP_TABS` → 3 reference tabs, default `tools`)                                                                                                                |
| Delete  | `components/McpDocsPageClient.tsx`, `components/SetupTab.tsx`, `components/ClientSetupDetails.tsx` (content ported into `install-recipes.tsx`)                                                |
| Keep    | `setup-helpers.tsx`, `GenerateApiKeyStep.tsx`, `mcp-tools-data.ts`, `tools-*.ts`, remaining tabs                                                                                              |

## Constraints & compatibility

- No external links point at the old tab hashes (verified); all external links use
  plain `/docs/mcp`, which keeps working.
- `tests/harness/flows.ts` expects `/MCP|Claude/i` on the page — hero satisfies it.
- File-size limits per CLAUDE.md §1.3 (one exported component per file).
- No hardcoded hex values; semantic tokens only (green success accents via the
  existing accent token usage pattern).

## Verification

`next build` in the worktree + live render check of `/docs/mcp` and
`/docs/mcp/reference` from a dev server on a spare port, real page in browser
(no mocked verification).

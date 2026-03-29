/**
 * Blog Post Prompt Templates
 *
 * Templates for two monthly auto-generated blog post types:
 * 1. Top 10 PropertyIQ Markets (unified score)
 * 2. Markets to Watch: Biggest Score Movers (month-over-month changes)
 *
 * Each function receives structured market data and returns a fully-formed
 * prompt that produces MDX-compatible content with frontmatter.
 */

export type BlogPostType =
  | 'top_propertyiq_markets'
  | 'top_homebuyer_markets'
  | 'top_investor_markets'
  | 'biggest_score_movers';

export interface RankedMarket {
  rank: number;
  location_name: string;
  location_id: string;
  score: number;
  grade: string;
}

export interface ScoreMover {
  location_name: string;
  location_id: string;
  current_score: number;
  previous_score: number;
  change: number;
  direction: 'up' | 'down';
}

const DATA_GROUNDING_RULE =
  'Use ONLY the data provided below. Do not fabricate or assume any numbers. If data is missing, say so.';

function formatRankedMarkets(markets: RankedMarket[]): string {
  return markets
    .map(
      (m) =>
        `${m.rank}. ${m.location_name} — Score: ${m.score}/100 (Grade: ${m.grade})`,
    )
    .join('\n');
}

function formatScoreMovers(movers: ScoreMover[]): string {
  return movers
    .map(
      (m) =>
        `- ${m.location_name}: ${m.previous_score} → ${m.current_score} (${m.direction === 'up' ? '+' : ''}${m.change.toFixed(1)} pts)`,
    )
    .join('\n');
}

function currentMonthYear(): string {
  const now = new Date();
  return now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Prompt: "Top 10 PropertyIQ Markets This Month"
 * Uses the top 10 PropertyIQ scores nationally.
 */
export function buildTopHomebuyerMarketsPrompt(
  markets: RankedMarket[],
): string {
  const monthYear = currentMonthYear();

  return `You are a real estate analyst writing a blog post for PropertyIQ, a data-driven real estate analytics platform.

Write a blog post titled "Top 10 PropertyIQ Markets — ${monthYear}" based on our PropertyIQ Score rankings.

The PropertyIQ Score (0-100) is a unified market quality score that predicts 3-year excess appreciation, factoring in affordability, momentum, stability, growth potential, and rental yield.

Top 10 PropertyIQ Markets:
${formatRankedMarkets(markets)}

Rules:
- Output ONLY valid MDX content starting with frontmatter (---) block
- Frontmatter must include: title, description, date (${new Date().toISOString().split('T')[0]}), author ("PropertyIQ Research"), category ("Market Rankings"), tags (array)
- Write 800-1200 words total (excluding frontmatter)
- Start with a 2-3 sentence introduction explaining the PropertyIQ Score methodology
- Dedicate a short paragraph (3-5 sentences) to each of the top 10 markets explaining why it ranks well
- End with a "Key Takeaways" section summarizing patterns across the top 10
- Use ## headers for major sections (Introduction, The Rankings, Key Takeaways)
- Use ### headers for each market (e.g., ### 1. Market Name — Score: XX/100)
- Reference specific scores and grades — do not generalize
- Write in an informative but accessible tone suitable for both homebuyers and investors
- ${DATA_GROUNDING_RULE}
- Do NOT use import statements or JSX components — pure markdown with frontmatter only`;
}

/** @deprecated Use buildTopHomebuyerMarketsPrompt (now generates unified PropertyIQ content) */
export function buildTopInvestorMarketsPrompt(markets: RankedMarket[]): string {
  return buildTopHomebuyerMarketsPrompt(markets);
}

/**
 * Prompt: "Markets to Watch: Biggest Score Movers This Month"
 * Uses the largest month-over-month score changes (both up and down).
 */
export function buildBiggestScoreMoversPrompt(
  risers: ScoreMover[],
  fallers: ScoreMover[],
): string {
  const monthYear = currentMonthYear();

  return `You are a real estate analyst writing a blog post for PropertyIQ, a data-driven real estate analytics platform.

Write a blog post titled "Markets to Watch: Biggest Score Movers — ${monthYear}" based on month-over-month changes in our PropertyIQ Score.

The PropertyIQ Score (0-100) predicts 3-year excess appreciation potential. Significant month-over-month changes signal shifting market conditions.

Biggest Risers (score increased most):
${formatScoreMovers(risers)}

Biggest Fallers (score decreased most):
${formatScoreMovers(fallers)}

Rules:
- Output ONLY valid MDX content starting with frontmatter (---) block
- Frontmatter must include: title, description, date (${new Date().toISOString().split('T')[0]}), author ("PropertyIQ Research"), category ("Market Trends"), tags (array)
- Write 800-1200 words total (excluding frontmatter)
- Start with a 2-3 sentence introduction explaining why score movements matter
- Create a "## Rising Markets" section covering each riser with 2-3 sentences on possible drivers
- Create a "## Declining Markets" section covering each faller with 2-3 sentences on possible causes
- End with a "## What This Means for You" section with actionable takeaways for both buyers and investors
- Reference specific score changes and directions — do not generalize
- Be balanced: rising scores aren't always "good" and falling scores aren't always "bad" — context matters
- Write in an informative but accessible tone
- ${DATA_GROUNDING_RULE}
- Do NOT use import statements or JSX components — pure markdown with frontmatter only`;
}

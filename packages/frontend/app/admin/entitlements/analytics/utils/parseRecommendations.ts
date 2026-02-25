/**
 * Client-side Recommendation Parser
 *
 * Parses AI-generated markdown into structured recommendation objects.
 * Handles multiple AI output formats:
 *   - `**[High] Title**`
 *   - `### **[High] Title**`
 *   - `**[High]** Title`
 *   - `### [High] Title`
 */

export type RecommendationStatus = 'pending' | 'implemented' | 'dismissed';
export type ActionType = 'db_change' | 'code_change' | 'manual';

export interface ParsedRecommendation {
  id: string;
  category: string;
  priority: 'High' | 'Medium' | 'Low';
  title: string;
  content: string;
  action_type: ActionType;
  status: RecommendationStatus;
}

const CATEGORY_HEADERS = [
  { emoji: '\u{1F534}', title: 'Conversion Blockers' },
  { emoji: '\u26A1', title: 'Quick Wins' },
  { emoji: '\u{1F4C8}', title: 'Growth Opportunities' },
  { emoji: '\u{1F50D}', title: 'Missing Tracking' },
  { emoji: '\u{1F4CA}', title: 'Retention Signals' },
  { emoji: '\u{1F4B0}', title: 'Pricing & Packaging' },
  { emoji: '\u{1F9EA}', title: 'Trial Health' },
  { emoji: '\u{1F4B8}', title: 'Revenue Leaks' },
  { emoji: '\u{1F310}', title: 'Acquisition Channels' },
  { emoji: '\u{1F3DB}\uFE0F', title: 'Brand & Authority' },
  { emoji: '\u{1F91D}', title: 'Monetization & Partnerships' },
];

/**
 * Matches all common AI priority patterns:
 *   ### **[High] Title**        → groups: "High", "Title"
 *   **[High] Title**            → groups: "High", "Title"
 *   ### **[High]** Title        → groups: "High", "Title" (handled by second pattern)
 *   **[Medium]** Some Title     → groups: "Medium", "Some Title"
 *   ### [High] Title            → groups: "High", "Title"
 */
const PRIORITY_PATTERNS = [
  // ### **[High] Title** or **[High] Title**
  /(?:^|\n)(?:#{1,4}\s+)?\*\*\[(High|Medium|Low)\]\s*([^*\n]+)\*\*/g,
  // ### **[High]** Title or **[High]** Title
  /(?:^|\n)(?:#{1,4}\s+)?\*\*\[(High|Medium|Low)\]\*\*\s*([^\n]+)/g,
  // ### [High] Title (no bold)
  /(?:^|\n)#{1,4}\s+\[(High|Medium|Low)\]\s*([^\n]+)/g,
];

let idCounter = 0;
function generateId(): string {
  idCounter++;
  return `rec-${Date.now()}-${idCounter}`;
}

interface PriorityMatch {
  priority: 'High' | 'Medium' | 'Low';
  title: string;
  index: number;
  fullMatchLength: number;
}

/**
 * Find all priority-tagged recommendations using multiple patterns.
 * Deduplicates by index to avoid double-matching.
 */
function findPriorityMatches(text: string): PriorityMatch[] {
  const found = new Map<number, PriorityMatch>();

  for (const pattern of PRIORITY_PATTERNS) {
    // Reset regex state
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      // Use the actual start of the priority bracket, not the newline
      const matchStart = match.index;
      // Avoid duplicates at the same position (within 5 chars)
      const isDuplicate = [...found.keys()].some(
        (idx) => Math.abs(idx - matchStart) < 5,
      );
      if (!isDuplicate) {
        found.set(matchStart, {
          priority: match[1] as 'High' | 'Medium' | 'Low',
          title: match[2].trim().replace(/\*+$/g, '').trim(),
          index: matchStart,
          fullMatchLength: match[0].length,
        });
      }
    }
  }

  // Sort by position in text
  return [...found.values()].sort((a, b) => a.index - b.index);
}

/**
 * Parse markdown into structured recommendations.
 */
export function parseRecommendationsFromMarkdown(
  markdown: string,
): ParsedRecommendation[] {
  const recommendations: ParsedRecommendation[] = [];
  const sections = splitByCategories(markdown);

  for (const section of sections) {
    recommendations.push(
      ...extractRecommendationsFromSection(section.content, section.title),
    );
  }

  return recommendations;
}

function splitByCategories(
  markdown: string,
): Array<{ title: string; content: string }> {
  const sections: Array<{ title: string; content: string }> = [];

  for (let i = 0; i < CATEGORY_HEADERS.length; i++) {
    const cat = CATEGORY_HEADERS[i];
    const header = `## ${cat.emoji} ${cat.title}`;
    const headerIndex = markdown.indexOf(header);
    if (headerIndex === -1) continue;

    const contentStart = headerIndex + header.length;
    let contentEnd = markdown.length;

    for (let j = i + 1; j < CATEGORY_HEADERS.length; j++) {
      const nextHeader = `## ${CATEGORY_HEADERS[j].emoji} ${CATEGORY_HEADERS[j].title}`;
      const nextIndex = markdown.indexOf(nextHeader, contentStart);
      if (nextIndex !== -1) {
        contentEnd = nextIndex;
        break;
      }
    }

    const content = markdown.slice(contentStart, contentEnd).trim();
    if (content) {
      sections.push({ title: cat.title, content });
    }
  }

  return sections;
}

function extractRecommendationsFromSection(
  sectionContent: string,
  category: string,
): ParsedRecommendation[] {
  const matches = findPriorityMatches(sectionContent);

  if (matches.length === 0) {
    // No structured recommendations — treat entire section as one
    return [
      {
        id: generateId(),
        category,
        priority: 'Medium',
        title: category,
        content: sectionContent,
        action_type: classifyActionType(sectionContent),
        status: 'pending',
      },
    ];
  }

  const recommendations: ParsedRecommendation[] = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const contentStart = match.index + match.fullMatchLength;
    const contentEnd =
      i + 1 < matches.length ? matches[i + 1].index : sectionContent.length;
    const content = sectionContent.slice(contentStart, contentEnd).trim();

    recommendations.push({
      id: generateId(),
      category,
      priority: match.priority,
      title: match.title,
      content,
      action_type: classifyActionType(content),
      status: 'pending',
    });
  }

  return recommendations;
}

function classifyActionType(content: string): ActionType {
  const lower = content.toLowerCase();

  const dbKeywords = [
    'feature flag',
    'toggle',
    'tier_feature',
    'tier feature',
    'update.*pricing',
    'change.*price',
    'set.*value',
    'update.*limit',
  ];
  if (dbKeywords.some((kw) => new RegExp(kw).test(lower))) {
    return 'db_change';
  }

  const codeKeywords = [
    'add component',
    'create page',
    'modify.*component',
    'tracking event',
    'meta tag',
    'seo',
    'add.*route',
    'create.*endpoint',
    'add.*button',
    'add.*banner',
    'add.*widget',
    'add.*section',
    'update.*layout',
    'add.*modal',
    'popup',
    'toast',
    'notification',
    'a/b test',
    'analytics.*event',
  ];
  if (codeKeywords.some((kw) => new RegExp(kw).test(lower))) {
    return 'code_change';
  }

  return 'manual';
}

/**
 * Recommendation Parser
 *
 * Parses AI-generated markdown insights into structured recommendation
 * objects. Handles multiple AI output formats for priority markers:
 *   - `**[High] Title**`
 *   - `### **[High] Title**`
 *   - `**[High]** Title`
 *   - `### [High] Title`
 */

import { randomUUID } from 'crypto';
import {
  ActionType,
  SavedRecommendation,
} from './ai-insights-persistence.types';

/** The 11 insight categories the AI generates. */
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

/** Multiple patterns to match AI priority markers. */
const PRIORITY_PATTERNS = [
  /(?:^|\n)(?:#{1,4}\s+)?\*\*\[(High|Medium|Low)\]\s*([^*\n]+)\*\*/g,
  /(?:^|\n)(?:#{1,4}\s+)?\*\*\[(High|Medium|Low)\]\*\*\s*([^\n]+)/g,
  /(?:^|\n)#{1,4}\s+\[(High|Medium|Low)\]\s*([^\n]+)/g,
];

interface PriorityMatch {
  priority: 'High' | 'Medium' | 'Low';
  title: string;
  index: number;
  fullMatchLength: number;
}

function findPriorityMatches(text: string): PriorityMatch[] {
  const found = new Map<number, PriorityMatch>();

  for (const pattern of PRIORITY_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const matchStart = match.index;
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

  return [...found.values()].sort((a, b) => a.index - b.index);
}

/**
 * Parse full insight markdown into structured recommendations.
 */
export function parseRecommendationsFromMarkdown(
  markdown: string,
): SavedRecommendation[] {
  const recommendations: SavedRecommendation[] = [];
  const categorySections = splitByCategories(markdown);

  for (const section of categorySections) {
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
      const nextCat = CATEGORY_HEADERS[j];
      const nextHeader = `## ${nextCat.emoji} ${nextCat.title}`;
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
): SavedRecommendation[] {
  const matches = findPriorityMatches(sectionContent);

  if (matches.length === 0) {
    return [
      {
        id: randomUUID(),
        category,
        priority: 'Medium',
        title: category,
        content: sectionContent,
        action_type: classifyActionType(sectionContent),
        status: 'pending',
      },
    ];
  }

  const recommendations: SavedRecommendation[] = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const contentStart = match.index + match.fullMatchLength;
    const contentEnd =
      i + 1 < matches.length ? matches[i + 1].index : sectionContent.length;
    const content = sectionContent.slice(contentStart, contentEnd).trim();

    recommendations.push({
      id: randomUUID(),
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

/**
 * Classify a recommendation's action type based on keyword heuristics.
 */
export function classifyActionType(content: string): ActionType {
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

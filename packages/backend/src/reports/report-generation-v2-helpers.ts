/**
 * Report Generation V2 Helpers
 *
 * Pure utility functions for the two-pass report generation pipeline:
 * - Template interpolation ({{var}} and {{#if var}}...{{/if}})
 * - AI response parsing with truncated JSON recovery
 * - News context appending
 */

import { Logger } from '@nestjs/common';
import type { NarrativePromptConfig } from './narrative-prompt-shared';

const logger = new Logger('ReportGenerationV2Helpers');

/**
 * Interpolate template variables and conditional blocks.
 *
 * - `{{variable}}` is replaced with `context[variable]`
 * - `{{#if var}}content{{/if}}` renders content only if var is truthy and not 'N/A'
 */
export function interpolateTemplate(
  template: string,
  context: Record<string, any>,
): string {
  // Handle {{#if var}}content{{/if}} conditional blocks
  let result = template.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, key, content) => {
      const value = context[key];
      if (value && value !== 'N/A' && value !== '') {
        return interpolateTemplate(content, context);
      }
      return '';
    },
  );

  // Handle {{variable}} replacements
  result = result.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const value = context[key];
    if (value === undefined || value === null) return _match;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });

  return result;
}

/**
 * Append news context to a prompt with contradiction-avoidance instructions.
 */
export function appendNewsContext(
  prompt: string,
  context: Record<string, any>,
): string {
  const newsContext = context.news_context;
  if (
    !newsContext ||
    newsContext === 'No recent news available for this market.'
  ) {
    return prompt;
  }

  return `${prompt}

---
MARKET INTELLIGENCE
${newsContext}

IMPORTANT — AVOIDING CONTRADICTIONS:
The Data section above is AUTHORITATIVE for Realtor.com and Zillow metrics. News articles may reference different geography levels or older time periods — do NOT substitute news-sourced values for authoritative data.`;
}

/**
 * Extract TITLE and SUBTITLE lines from an outline response.
 *
 * Expected format in the outline text:
 *   TITLE: Some compelling title here
 *   SUBTITLE: One sentence expanding on the title.
 */
export function extractTitleAndSubtitle(outline: string): {
  title: string | null;
  subtitle: string | null;
} {
  const titleMatch = outline.match(/^TITLE:\s*(.+)$/m);
  const subtitleMatch = outline.match(/^SUBTITLE:\s*(.+)$/m);
  return {
    title: titleMatch?.[1]?.trim() || null,
    subtitle: subtitleMatch?.[1]?.trim() || null,
  };
}

/**
 * Extract ACTION_ITEMS_JSON from a text AI response.
 *
 * Some text-format sections (investment_thesis, verdict_and_actions) include
 * an ACTION_ITEMS_JSON: [...] block after the prose. This function splits the
 * response into narrative text and parsed action items.
 *
 * Returns { narrative, action_items } if the marker is found, or
 * { narrative: text, action_items: null } if not.
 */
export function extractActionItems(text: string): {
  narrative: string;
  action_items: any[] | null;
} {
  const markerPattern = /\n?\s*ACTION_ITEMS_JSON:\s*\n?/i;
  const match = text.match(markerPattern);

  if (!match || match.index === undefined) {
    return { narrative: text.trim(), action_items: null };
  }

  const narrative = text.substring(0, match.index).trim();
  const jsonPart = text.substring(match.index + match[0].length).trim();

  try {
    const cleaned = jsonPart
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return { narrative, action_items: parsed };
    }
    logger.warn('[v2] ACTION_ITEMS_JSON parsed but is not an array');
    return { narrative, action_items: null };
  } catch {
    // Try truncated recovery (same pattern as parseAiResponse)
    const lastBrace = jsonPart.lastIndexOf('}');
    if (lastBrace > 0) {
      try {
        const truncated = jsonPart.substring(0, lastBrace + 1).trimStart();
        const recovered = JSON.parse(
          truncated.startsWith('[') ? truncated + ']' : '[' + truncated + ']',
        );
        if (Array.isArray(recovered) && recovered.length > 0) {
          logger.warn(
            `[v2] Recovered ${recovered.length} action items from truncated JSON`,
          );
          return { narrative, action_items: recovered };
        }
      } catch {
        // Recovery also failed
      }
    }
    logger.warn('[v2] Failed to parse ACTION_ITEMS_JSON, discarding block');
    return { narrative, action_items: null };
  }
}

/**
 * Parse an AI response, handling JSON output formats with truncation recovery.
 */
export function parseAiResponse(
  content: string,
  outputFormat: NarrativePromptConfig['output_format'],
  sectionId: string,
): string | any {
  if (outputFormat !== 'json_array' && outputFormat !== 'json_object') {
    return content;
  }

  const cleaned = content
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Attempt recovery for truncated JSON arrays
    if (cleaned.startsWith('[')) {
      try {
        const lastBrace = cleaned.lastIndexOf('}');
        if (lastBrace > 0) {
          const truncated = cleaned.substring(0, lastBrace + 1) + ']';
          const parsed = JSON.parse(truncated);
          if (Array.isArray(parsed) && parsed.length > 0) {
            logger.warn(
              `[v2] Recovered ${parsed.length} items from truncated JSON for ${sectionId}`,
            );
            return parsed;
          }
        }
      } catch {
        // Recovery also failed
      }
    }
    logger.warn(
      `[v2] Failed to parse JSON for ${sectionId}, returning raw string`,
    );
    return content;
  }
}

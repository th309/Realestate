/**
 * Research Narrative Generator
 *
 * Handles the final step of the research brief pipeline:
 * takes structured research data and generates a prose narrative
 * via AiProviderService (purpose: 'research_narrative').
 *
 * Extracted from ResearchBriefService to keep file sizes under limit.
 */

import { Logger } from '@nestjs/common';
import { AiProviderService } from '../../ai-provider/ai-provider.service';
import { buildNarrativePrompt } from './research-prompts';

const logger = new Logger('ResearchNarrativeGenerator');

/** Max characters of research JSON to include in the prompt.
 * DeepSeek Reasoner supports 128K context. Keep data reasonably
 * sized to avoid slow inference, but we have much more room than chat. */
const MAX_DATA_CHARS = 24_000;

/**
 * Truncate research data to stay within token limits.
 * Attempts to find a clean JSON boundary to truncate at.
 */
function truncateResearchData(
  researchData: Record<string, unknown>,
): Record<string, unknown> {
  const serialized = JSON.stringify(researchData);
  if (serialized.length <= MAX_DATA_CHARS) return researchData;

  logger.warn(
    `Research data truncated from ${serialized.length} to ~${MAX_DATA_CHARS} chars`,
  );
  try {
    const cutPoint = serialized.lastIndexOf('}', MAX_DATA_CHARS);
    return JSON.parse(serialized.substring(0, cutPoint) + '}');
  } catch {
    // If truncation breaks JSON, return a summary instead
    return {
      warning: 'Research data was too large and could not be truncated safely',
    };
  }
}

/**
 * Generate the final narrative from structured research data.
 * Uses AiProviderService with purpose 'research_narrative'.
 */
export async function generateNarrative(
  aiProvider: AiProviderService,
  userQuestion: string,
  researchData: Record<string, unknown>,
  clarifyingContext?: string,
): Promise<string> {
  const safeData = truncateResearchData(researchData);
  const prompt = buildNarrativePrompt(
    userQuestion,
    safeData,
    clarifyingContext,
  );

  logger.log(`Narrative prompt: ${prompt.length} chars`);
  logger.log(`Research data keys: ${Object.keys(researchData).join(', ')}`);

  try {
    const response = await aiProvider.complete('research_narrative', {
      userPrompt: prompt,
      maxTokens: 8192,
    });

    logger.log(
      `Narrative generated in ${response.durationMs}ms via ${response.provider}/${response.model}`,
    );

    const raw = response.content || 'Unable to generate research brief.';
    return stripInlineMarkdown(raw);
  } catch (error: any) {
    logger.error(`Narrative generation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Strip inline markdown formatting that the frontend can't render.
 * Preserves ## headers and - bullet points (which the frontend handles).
 * Removes: **bold**, *italic*, `code`, [links](url)
 */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1') // **bold** → bold
    .replace(/\*(.+?)\*/g, '$1') // *italic* → italic
    .replace(/`([^`]+)`/g, '$1') // `code` → code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // [text](url) → text
}

/**
 * Extract structured research data from Claude's final response.
 */
export function extractResearchData(
  content: Array<{ type: string; text?: string }>,
): Record<string, unknown> {
  const textBlocks = content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text);

  const fullText = textBlocks.join('\n');
  try {
    return extractJson(fullText);
  } catch {
    return { raw_response: fullText };
  }
}

/**
 * Extract JSON from text that may contain markdown code fences.
 */
export function extractJson(text: string): Record<string, any> {
  // Try code-fenced JSON first
  const fenceMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/);
  if (fenceMatch) {
    return JSON.parse(fenceMatch[1].trim());
  }
  // Try raw JSON
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    return JSON.parse(text.substring(jsonStart, jsonEnd + 1));
  }
  throw new Error('No JSON found in response');
}

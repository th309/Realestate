/**
 * Standalone functions for classifying real estate news articles via LLM.
 * Pure functions with explicit dependencies (AppConfigService).
 */

import OpenAI from 'openai';
import { AppConfigService } from '../config/app-config.service';

/** Parsed LLM classification of an article */
export interface ArticleClassification {
  summary: string;
  tags: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
}

const LLM_TIMEOUT_MS = 15_000;

/** Classify an article via LLM. Falls back to defaults on failure. */
export async function classifyArticle(
  headline: string,
  description: string,
  appConfig: AppConfigService,
): Promise<ArticleClassification> {
  try {
    return await callLlmForClassification(headline, description, appConfig);
  } catch {
    return buildFallbackClassification(headline);
  }
}

async function callLlmForClassification(
  headline: string,
  description: string,
  appConfig: AppConfigService,
): Promise<ArticleClassification> {
  const [baseUrl, model, apiKey] = await Promise.all([
    appConfig.get('AI_BASE_URL', 'https://api.deepseek.com'),
    appConfig.get('AI_MODEL', 'deepseek-chat'),
    appConfig.get('DEEPSEEK_API_KEY'),
  ]);

  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');

  const client = new OpenAI({ baseURL: baseUrl, apiKey });
  const prompt = buildClassificationPrompt(headline, description);

  const response = await Promise.race([
    client.chat.completions.create({
      model,
      messages: [{ role: 'system', content: prompt }],
      max_tokens: 300,
      temperature: 0.3,
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('LLM request timed out')), LLM_TIMEOUT_MS),
    ),
  ]);

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM returned empty response');

  return parseLlmClassification(content, headline);
}

function buildClassificationPrompt(headline: string, description: string): string {
  return `Classify this real estate news article.

Headline: ${headline}
Description: ${description}

Return ONLY valid JSON (no markdown fences):
{
  "summary": "1-2 sentence summary",
  "tags": ["housing", "prices", ...],
  "sentiment": "positive|negative|neutral"
}`;
}

/** Parse the LLM JSON response, falling back gracefully */
function parseLlmClassification(
  raw: string, headline: string,
): ArticleClassification {
  try {
    // Strip markdown fences if present
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : headline,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      sentiment: ['positive', 'negative', 'neutral'].includes(parsed.sentiment)
        ? parsed.sentiment
        : 'neutral',
    };
  } catch {
    return buildFallbackClassification(headline);
  }
}

function buildFallbackClassification(headline: string): ArticleClassification {
  return {
    summary: headline,
    tags: [],
    sentiment: 'neutral',
  };
}

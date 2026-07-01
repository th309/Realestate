/**
 * DeepSeek LLM call for briefing narrative + suggested questions, extracted from
 * BriefingGeneratorService to keep that file under the line limit. Metered by
 * the shared AI spend guard (guardedChat).
 */

import OpenAI from 'openai';
import { AppConfigService } from '../config/app-config.service';
import { guardedChat } from '../ai-provider/ai-spend-guard.shared';

export async function callBriefingLlm(
  appConfig: AppConfigService,
  prompt: string,
): Promise<string> {
  const [baseUrl, model, apiKey, timeoutMs, maxTokens, temperatureStr] =
    await Promise.all([
      appConfig.get('AI_BASE_URL', 'https://api.deepseek.com'),
      appConfig.get('AI_MODEL', 'deepseek-v4-pro'),
      appConfig.get('DEEPSEEK_API_KEY'),
      appConfig.getNumber('QUINN_LLM_TIMEOUT_MS', 30000),
      appConfig.getNumber('QUINN_LLM_MAX_TOKENS', 500),
      appConfig.get('QUINN_LLM_TEMPERATURE', '0.7'),
    ]);

  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');

  const client = new OpenAI({ baseURL: baseUrl, apiKey });
  const temperature = parseFloat(temperatureStr) || 0.7;

  const response = await Promise.race([
    guardedChat(model, () =>
      client.chat.completions.create({
        model,
        messages: [{ role: 'system', content: prompt }],
        max_tokens: maxTokens,
        temperature,
      }),
    ),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('LLM request timed out')), timeoutMs),
    ),
  ]);

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM returned empty response');
  return content;
}

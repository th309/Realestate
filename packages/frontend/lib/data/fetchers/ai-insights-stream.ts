/**
 * AI INSIGHTS HEADER STREAM
 *
 * POST /api/analyzer/ai-insights/header returns a text/event-stream with
 * `data: {"chunk":"..."}\n\n` chunks ended by `data: [DONE]\n\n`.
 * Errors arrive as `data: {"error":"..."}\n\n` before the connection closes.
 */

import { API_URL } from "./base";
import { getAuthHeaders } from "./auth-headers";
import type { AiInsightPayload } from "./ai-insights";

export async function* streamAiHeaderInsight(
  payload: AiInsightPayload,
): AsyncGenerator<string> {
  const url = `${API_URL}/api/analyzer/ai-insights/header`;
  const headers = await getAuthHeaders();
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  if (!res.ok || !res.body) throw new Error(`ai-header ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data) as {
          chunk?: string;
          error?: string;
        };
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.chunk) yield parsed.chunk;
      } catch (e) {
        if (e instanceof Error && e.message !== data) throw e;
      }
    }
  }
}

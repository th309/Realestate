/**
 * REPORT CONVERSATION FETCHERS
 *
 * Streaming AI chat ("Ask AI" panel) for a report, plus conversation
 * history. Split out of reports.ts per CLAUDE.md §1.3 file-size limits.
 *
 * POST /api/reports/:id/conversation returns a text/event-stream with
 * `data: {"type":"text","content":"..."}\n\n` chunks, ended by
 * `data: {"type":"done"}\n\n`. Errors arrive as
 * `data: {"type":"error","content":"..."}\n\n` before the connection closes.
 */

import { API_URL } from "./base";
import { getAuthHeaders } from "./auth-headers";

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export type ConversationStreamEvent =
  | { type: "text"; content: string }
  | { type: "done" }
  | { type: "error"; content: string };

interface GetConversationResponse {
  messages: ConversationMessage[];
  exchange_count: number;
}

/**
 * Send a message in a report conversation, streaming the AI's reply as it's
 * generated.
 */
export async function* streamReportMessage(
  reportId: string,
  content: string,
  options: { userId: string; userTier?: string },
): AsyncGenerator<ConversationStreamEvent> {
  const authHeaders = await getAuthHeaders();
  const headers: Record<string, string> = {
    ...authHeaders,
    "Content-Type": "application/json",
    "x-user-id": options.userId,
  };
  if (options.userTier) {
    headers["x-user-tier"] = options.userTier;
  }

  const response = await fetch(
    `${API_URL}/api/reports/${reportId}/conversation`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ content }),
    },
  );

  if (!response.ok || !response.body) {
    throw new Error(`Failed to send message: ${response.status}`);
  }

  const reader = response.body.getReader();
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
      if (!data) continue;
      try {
        yield JSON.parse(data) as ConversationStreamEvent;
      } catch {
        // Skip malformed JSON lines (e.g. partial chunks)
      }
    }
  }
}

/**
 * Fetch conversation history for a report.
 */
export async function fetchReportConversation(
  reportId: string,
  options: { userId: string },
): Promise<GetConversationResponse> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(
    `${API_URL}/api/reports/${reportId}/conversation`,
    {
      headers: {
        ...authHeaders,
        "x-user-id": options.userId,
      },
    },
  );

  if (!response.ok) {
    if (response.status === 404) return { messages: [], exchange_count: 0 };
    throw new Error(`Failed to fetch conversation: ${response.status}`);
  }

  return response.json();
}

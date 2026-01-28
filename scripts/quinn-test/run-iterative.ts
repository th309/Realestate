#!/usr/bin/env npx tsx
/**
 * Quinn Iterative Test Runner
 *
 * Sends a list of prompts to the Quinn analytics-chat backend and prints
 * success/failure, duration, tools used, and response length for each.
 * Use this to regression-test Quinn without manual UI testing.
 *
 * Prerequisites:
 *   - Backend running: cd packages/backend && npm run start:dev
 *   - ANTHROPIC_API_KEY set in packages/backend/.env
 *
 * Usage:
 *   npx tsx scripts/quinn-test/run-iterative.ts
 *   npx tsx scripts/quinn-test/run-iterative.ts prompts.txt
 *   npx tsx scripts/quinn-test/run-iterative.ts --url <backend-url>
 *   QUINN_TEST_BACKEND_URL=<url> npx tsx scripts/quinn-test/run-iterative.ts
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/** Default: Railway backend. Override with QUINN_TEST_BACKEND_URL or BACKEND_URL. */
const DEFAULT_BACKEND = 'https://backend-production-ee4d.up.railway.app';

const BACKEND_URL =
  process.env.QUINN_TEST_BACKEND_URL ||
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  DEFAULT_BACKEND;

interface ChatResponse {
  success: boolean;
  response?: string;
  toolsUsed?: string[];
  structuredData?: unknown;
  modelUsed?: string;
  conversationId: string;
  error?: string;
}

const DEFAULT_PROMPTS = [
  'Find hot markets',
  'Compare Texas metros to the national average',
  'What are Austin home prices?',
  'Which metros have the best rental yields?',
];

function generateConversationId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function sendMessage(
  conversationId: string,
  message: string,
  context?: { geographyType?: string; geographyId?: string; geographyName?: string }
): Promise<{ durationMs: number; data: ChatResponse }> {
  const start = Date.now();
  const res = await fetch(`${BACKEND_URL}/analytics/chat/${conversationId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: message.trim(), context }),
  });
  const durationMs = Date.now() - start;
  const data = (await res.json()) as ChatResponse;
  if (!res.ok) {
    return {
      durationMs,
      data: {
        success: false,
        conversationId,
        error: data?.error ?? `HTTP ${res.status}`,
      },
    };
  }
  return { durationMs, data };
}

function loadPrompts(path: string): string[] {
  const p = path.startsWith('/') || /^[A-Za-z]:/.test(path)
    ? path
    : join(process.cwd(), path);
  if (!existsSync(p)) {
    console.error(`Prompts file not found: ${p}`);
    process.exit(1);
  }
  const text = readFileSync(p, 'utf-8');
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !s.startsWith('#'));
}

function parseArgs(): { promptsPath?: string; backendUrl?: string } {
  const args = process.argv.slice(2);
  const out: { promptsPath?: string; backendUrl?: string } = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      out.backendUrl = args[++i];
    } else if (!args[i].startsWith('-')) {
      out.promptsPath = args[i];
    }
  }
  return out;
}

async function main() {
  const { promptsPath, backendUrl } = parseArgs();
  const baseUrl = backendUrl ?? BACKEND_URL;
  const prompts = promptsPath ? loadPrompts(promptsPath) : DEFAULT_PROMPTS;

  console.log('Quinn iterative test');
  console.log('Backend:', baseUrl);
  console.log('Prompts:', prompts.length);
  console.log('');

  const results: Array<{
    prompt: string;
    ok: boolean;
    durationMs: number;
    toolsUsed: string[];
    responseLen: number;
    error?: string;
  }> = [];

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    const conversationId = generateConversationId();
    process.stdout.write(`[${i + 1}/${prompts.length}] ${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''} ... `);
    try {
      const { durationMs, data } = await sendMessage(conversationId, prompt);
      const ok = data.success === true;
      results.push({
        prompt,
        ok,
        durationMs,
        toolsUsed: data.toolsUsed ?? [],
        responseLen: (data.response ?? '').length,
        error: data.error,
      });
      const status = ok ? `OK ${durationMs}ms` : `FAIL ${data.error ?? 'unknown'}`;
      console.log(status);
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      results.push({
        prompt,
        ok: false,
        durationMs: 0,
        toolsUsed: [],
        responseLen: 0,
        error: err,
      });
      console.log('FAIL', err);
    }
  }

  console.log('');
  console.log('--- Summary ---');
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`Passed: ${passed}  Failed: ${failed}`);
  if (failed > 0) {
    results.filter((r) => !r.ok).forEach((r) => {
      console.log(`  FAIL: "${r.prompt.slice(0, 40)}..." -> ${r.error}`);
    });
  }
  const avgMs = results.length
    ? Math.round(results.reduce((a, r) => a + r.durationMs, 0) / results.length)
    : 0;
  console.log(`Avg response time: ${avgMs}ms`);
  process.exit(failed > 0 ? 1 : 0);
}

main();

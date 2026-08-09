/**
 * SSE Response Writer
 *
 * Shared boilerplate for driving an async generator into an Express
 * Server-Sent-Events response — same framing already used by
 * ai-insights.controller.ts, extracted so new SSE endpoints (e.g. the
 * reports conversation stream) don't have to re-inline it.
 */

import { Response } from 'express';

/**
 * Sets SSE headers, writes each yielded event as a `data: ...` line, and
 * ends the response when the generator completes or throws.
 */
export async function writeSseGeneratorResponse(
  res: Response,
  generator: AsyncGenerator<Record<string, unknown>>,
): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    for await (const event of generator) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (error: any) {
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        content: error.message || 'Stream failed',
      })}\n\n`,
    );
  } finally {
    res.end();
  }
}

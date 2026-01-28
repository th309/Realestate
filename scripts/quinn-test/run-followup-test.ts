#!/usr/bin/env npx tsx
/**
 * Quick follow-up test: one conversationId, two messages.
 * Validates "out of those, which ..." works after a rankings reply.
 */
const DEFAULT_BACKEND = 'https://backend-production-ee4d.up.railway.app';
const BACKEND_URL = process.env.QUINN_TEST_BACKEND_URL || process.env.BACKEND_URL || DEFAULT_BACKEND;
const CONV_ID = `followup-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

async function send(conversationId: string, message: string) {
  const res = await fetch(`${BACKEND_URL}/analytics/chat/${conversationId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: message.trim() }),
  });
  const data = await res.json();
  return { ok: res.ok && data?.success, data, status: res.status };
}

async function main() {
  const m1 = 'What are the top places in Florida to buy right now?';
  const m2 = 'Out of those, which has seen the most drastic price drop in the last 2 years?';

  console.log('Backend:', BACKEND_URL);
  console.log('ConversationId:', CONV_ID);
  console.log('');
  console.log('[1]', m1);
  const r1 = await send(CONV_ID, m1);
  console.log('    ', r1.ok ? 'OK' : 'FAIL', r1.data?.error || '');
  if (!r1.ok) {
    console.error('    ', r1.data);
    process.exit(1);
  }
  console.log('');
  console.log('[2]', m2);
  const r2 = await send(CONV_ID, m2);
  console.log('    ', r2.ok ? 'OK' : 'FAIL', r2.data?.error || '');
  if (r2.data?.response) console.log('    Response:', (r2.data.response as string).slice(0, 500));
  if (!r2.ok) console.error('    ', r2.data);
  process.exit(r2.ok ? 0 : 1);
}

main();

import { ImapFlow } from "imapflow";

const host = "imap.gmail.com";
const user = process.env.TEST_GMAIL_USER;
const pass = process.env.TEST_GMAIL_APP_PASSWORD;

async function withInbox<T>(fn: (c: ImapFlow) => Promise<T>): Promise<T> {
  if (!user || !pass)
    throw new Error("TEST_GMAIL_USER / TEST_GMAIL_APP_PASSWORD required");
  const client = new ImapFlow({
    host,
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout();
  }
}

/** Poll for the newest message to `toAddress` whose subject matches, return its text. */
export async function waitForEmail(
  toAddress: string,
  subjectRe: RegExp,
  timeoutMs = 120_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const body = await withInbox(async (c) => {
      const lock = await c.getMailboxLock("INBOX");
      try {
        const uids = await c.search({ to: toAddress }, { uid: true });
        if (!uids) return null;
        for (const uid of uids.slice(-10).reverse()) {
          const msg = await c.fetchOne(
            String(uid),
            { envelope: true, source: true },
            { uid: true },
          );
          if (
            msg &&
            msg.envelope &&
            subjectRe.test(msg.envelope.subject ?? "")
          ) {
            return msg.source ? msg.source.toString() : null;
          }
        }
        return null;
      } finally {
        lock.release();
      }
    });
    if (body) return body;
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(
    `Timed out waiting for email to ${toAddress} matching ${subjectRe}`,
  );
}

export async function waitForOtp(toAddress: string): Promise<string> {
  const body = await waitForEmail(
    toAddress,
    /verify|confirm|code|PropertyIQ/i,
    120_000,
  );
  const m = body.match(/\b(\d{6})\b/);
  if (!m) throw new Error("No 6-digit code found in OTP email");
  return m[1];
}

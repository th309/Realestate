import { ImapFlow } from "imapflow";
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from "fs";
import { join } from "path";

const host = "imap.gmail.com";
const user = process.env.TEST_GMAIL_USER;
const pass = process.env.TEST_GMAIL_APP_PASSWORD;

/**
 * Bridge mode: in TLS-intercepted environments (e.g. a local AV mail-shield
 * that breaks IMAP), the controller reads Gmail out-of-band and drops the OTP
 * into a file. Enabled by setting OTP_BRIDGE_DIR. Inbox-blocking `waitForEmail`
 * checks become no-ops in this mode (delivery is asserted via the DB email_log
 * plus the controller's own Gmail confirmation).
 */
const bridgeDir = process.env.OTP_BRIDGE_DIR;

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
  // Bridge mode: delivery is confirmed out-of-band; don't block the run.
  if (bridgeDir) return "";

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

/**
 * Bridge OTP retrieval: signal that the run is waiting, then poll for the
 * controller-supplied code. Returns the 6-digit code.
 */
async function waitForOtpViaBridge(timeoutMs: number): Promise<string> {
  const dir = bridgeDir as string;
  mkdirSync(dir, { recursive: true });
  const codeFile = join(dir, "otp.txt");
  const requestFile = join(dir, "otp-request");
  // Clear any stale code, then signal a fresh request.
  if (existsSync(codeFile)) rmSync(codeFile);
  writeFileSync(requestFile, String(Date.now()));

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(codeFile)) {
      const raw = readFileSync(codeFile, "utf8").trim();
      const m = raw.match(/\b(\d{6})\b/);
      if (m) {
        rmSync(codeFile);
        if (existsSync(requestFile)) rmSync(requestFile);
        return m[1];
      }
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`OTP bridge timed out waiting for ${codeFile}`);
}

export async function waitForOtp(toAddress: string): Promise<string> {
  if (bridgeDir) return waitForOtpViaBridge(180_000);

  const body = await waitForEmail(
    toAddress,
    /verify|confirm|code|PropertyIQ/i,
    120_000,
  );
  const m = body.match(/\b(\d{6})\b/);
  if (!m) throw new Error("No 6-digit code found in OTP email");
  return m[1];
}

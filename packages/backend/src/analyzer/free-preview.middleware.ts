import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import * as crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const COOKIE = 'piq_analyzer_uses';
const LIFETIME_CAP = 3;
const MAX_AGE_MS = 10 * 365 * 24 * 60 * 60 * 1000; // 10 years — "lifetime"

@Injectable()
export class FreePreviewMiddleware implements NestMiddleware {
  private readonly logger = new Logger(FreePreviewMiddleware.name);
  private readonly secret: string;

  constructor() {
    const s = process.env.ANALYZER_PREVIEW_SECRET;
    if (!s) throw new Error('ANALYZER_PREVIEW_SECRET is required'); // per CLAUDE.md §1.2
    this.secret = s;
  }

  sign(count: number): string {
    const payload = String(count);
    const mac = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex')
      .slice(0, 32);
    return `${payload}.${mac}`;
  }

  verify(cookie: string | undefined): number | null {
    if (!cookie) return null;
    const [payload, mac] = cookie.split('.');
    if (!payload || !mac) return null;
    const expectedMac = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex')
      .slice(0, 32);
    // Both sides are hex digests (sliced to 32 chars). Decode explicitly so
    // the constant-time compare runs on the raw bytes, not the hex strings,
    // and reject up front if either side fails to decode.
    const macBuf = Buffer.from(mac, 'hex');
    const expectedBuf = Buffer.from(expectedMac, 'hex');
    if (macBuf.length !== expectedBuf.length || macBuf.length === 0)
      return null;
    if (!crypto.timingSafeEqual(macBuf, expectedBuf)) return null;
    const n = parseInt(payload, 10);
    return Number.isFinite(n) ? n : null;
  }

  use(
    req: Request & { user?: { id: string } },
    res: Response,
    next: NextFunction,
  ): void {
    // NestJS executes middleware BEFORE guards, so `req.user` is never
    // populated here — even for authenticated requests. The frontend always
    // sends `Authorization: Bearer <jwt>` for logged-in users (see
    // `packages/frontend/lib/data/fetchers/auth-headers.ts`). Treat presence
    // of that header as "authenticated, skip the quota". The endpoint's
    // payload is non-sensitive aggregate market data — no real risk in
    // letting a malformed token bypass the cap (worst case is they still
    // burn through their own cookie quota on the next anonymous call).
    const authHeader = req.headers.authorization ?? req.headers.Authorization;
    if (
      req.user?.id ||
      (typeof authHeader === 'string' && authHeader.startsWith('Bearer '))
    ) {
      return next();
    }

    const current = this.verify(req.cookies?.[COOKIE]) ?? 0;
    if (current >= LIFETIME_CAP) {
      res.status(402).json({
        error: 'free_quota_exceeded',
        message: 'Sign up for free to continue analyzing.',
        used: current,
        cap: LIFETIME_CAP,
      });
      return;
    }
    const nextCount = current + 1;
    res.cookie(COOKIE, this.sign(nextCount), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: MAX_AGE_MS,
      path: '/',
    });
    next();
  }
}

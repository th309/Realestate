import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

/**
 * Attaches a stable x-request-id to every request and logs structured
 * ingress/egress lines. The ID is either forwarded from the caller (useful
 * when Railway's load balancer or Vercel already stamps one) or generated
 * as a fresh UUID v4.
 *
 * This makes every Sentry error traceable back to the originating request
 * without any additional instrumentation.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId =
      (req.headers['x-request-id'] as string) || randomUUID();
    const startTime = Date.now();

    // Forward the ID on both the request (for downstream services) and response
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);

    this.logger.log(
      `→ ${req.method} ${req.path} requestId=${requestId}`,
    );

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const level =
        res.statusCode >= 500
          ? 'error'
          : res.statusCode >= 400
            ? 'warn'
            : 'log';

      this.logger[level](
        `← ${req.method} ${req.path} ${res.statusCode} ${duration}ms requestId=${requestId}`,
      );
    });

    next();
  }
}

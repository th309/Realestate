/**
 * Platform API v1 Exception Filter
 *
 * Guards (ApiKeyAuthGuard, ApiThrottleGuard) throw BEFORE the
 * ApiResponseInterceptor runs, so their 401/403/429 errors would otherwise
 * return the raw NestJS shape ({ message, error, statusCode }) instead of the
 * documented v1 envelope ({ error: { code, message, request_id } }). This
 * controller-scoped filter normalizes every v1 error onto that envelope so
 * integrators can rely on error.code for auth / scope / rate-limit failures too.
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import * as crypto from 'crypto';

const STATUS_CODE: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  429: 'RATE_LIMIT_EXCEEDED',
};

@Catch()
export class PlatformApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;

    // Prefer a structured code/message from the thrown HttpException; fall back
    // to a clean status-derived code so error.code is always stable.
    let code: string | null = null;
    let message = 'An unexpected error occurred';
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null) {
        code = ((res as Record<string, unknown>).code as string | null) ?? null;
        const m = (res as Record<string, unknown>).message;
        message = Array.isArray(m)
          ? m.join(', ')
          : ((m as string) ?? exception.message);
      } else if (typeof res === 'string') {
        message = res;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const requestId =
      request.platformRequestId ??
      `req_${crypto.randomBytes(4).toString('hex')}`;

    response.status(status).json({
      error: {
        code: code || STATUS_CODE[status] || 'INTERNAL_ERROR',
        message,
        request_id: requestId,
      },
    });
  }
}

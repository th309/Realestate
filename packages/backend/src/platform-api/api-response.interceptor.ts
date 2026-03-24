/**
 * API Response Envelope Interceptor
 *
 * Wraps all v1 Platform API responses in a standard envelope format.
 *
 * Success responses:
 * {
 *   "data": { ... },
 *   "meta": {
 *     "request_id": "req_7f3a2b1c",
 *     "timestamp": "2026-03-24T14:30:00Z",
 *     "rate_limit": { "limit": 60, "remaining": 54, "reset_at": "..." }
 *   }
 * }
 *
 * Error responses:
 * {
 *   "error": {
 *     "code": "INVALID_GEO_LEVEL",
 *     "message": "...",
 *     "request_id": "req_7f3a2b1c"
 *   }
 * }
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, EMPTY } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import * as crypto from 'crypto';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const requestId = `req_${crypto.randomBytes(4).toString('hex')}`;

    // Attach request_id so downstream handlers can reference it
    request.platformRequestId = requestId;

    return next.handle().pipe(
      map((data) => ({
        data,
        meta: {
          request_id: requestId,
          timestamp: new Date().toISOString(),
          rate_limit: request.rateLimitInfo || null,
        },
      })),
      catchError((err) => {
        const response = context.switchToHttp().getResponse();
        const status = err.status || err.getStatus?.() || 500;

        // Extract structured error from NestJS HttpException
        const errResponse = err.getResponse?.() || {};
        const code = typeof errResponse === 'object' ? errResponse.code : null;
        const message =
          typeof errResponse === 'object'
            ? errResponse.message
            : typeof errResponse === 'string'
              ? errResponse
              : err.message;

        response.status(status).json({
          error: {
            code: code || this.deriveErrorCode(message) || 'INTERNAL_ERROR',
            message: message || 'An unexpected error occurred',
            request_id: requestId,
          },
        });

        return EMPTY;
      }),
    );
  }

  /**
   * Derive a machine-readable error code from a human message.
   * e.g. "Invalid geo level" -> "INVALID_GEO_LEVEL"
   */
  private deriveErrorCode(message: string | undefined): string | null {
    if (!message || typeof message !== 'string') return null;
    return message
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '_');
  }
}

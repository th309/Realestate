/**
 * Embed CORS Interceptor
 *
 * Sets dynamic CORS headers for embed widget endpoints.
 * When a validated embed token is present (request.embedOrg),
 * sets the specific requesting origin. Otherwise falls back
 * to permissive CORS for public embeds.
 *
 * Also handles OPTIONS preflight requests by returning 204.
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';

@Injectable()
export class EmbedCorsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const origin = request.headers?.origin;

    if (request.embedOrg) {
      // Token-based embed — echo the specific origin
      if (origin) {
        response.setHeader('Access-Control-Allow-Origin', origin);
      }
    } else {
      // Public embed — allow all origins
      response.setHeader('Access-Control-Allow-Origin', '*');
    }

    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (request.method === 'OPTIONS') {
      response.status(204).send();
      return of(undefined);
    }

    return next.handle();
  }
}

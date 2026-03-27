import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiMetricsBufferService } from '../services/api-metrics-buffer.service';

@Injectable()
export class ApiMetricsInterceptor implements NestInterceptor {
  constructor(private readonly buffer: ApiMetricsBufferService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<{ url: string }>();
    const response = context
      .switchToHttp()
      .getResponse<{ statusCode: number }>();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.buffer.record({
            endpoint: request.url,
            duration_ms: Date.now() - start,
            status_code: response.statusCode,
            timestamp: start,
          });
        },
        error: () => {
          this.buffer.record({
            endpoint: request.url,
            duration_ms: Date.now() - start,
            status_code: response.statusCode || 500,
            timestamp: start,
          });
        },
      }),
    );
  }
}

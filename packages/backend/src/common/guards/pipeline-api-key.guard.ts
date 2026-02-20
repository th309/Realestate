/**
 * Pipeline API Key Guard
 *
 * Validates the Authorization header against the PIPELINE_API_KEY env variable.
 * Used to protect endpoints that only pipeline scripts should call
 * (e.g., POST /api/health/pipeline-status).
 *
 * The pipeline scripts send: Authorization: Bearer {PIPELINE_API_KEY}
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class PipelineApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers.authorization;
    const pipelineKey = process.env.PIPELINE_API_KEY;

    if (!pipelineKey) {
      throw new UnauthorizedException('PIPELINE_API_KEY not configured');
    }

    if (
      !authHeader ||
      !authHeader.startsWith('Bearer ') ||
      authHeader.slice(7) !== pipelineKey
    ) {
      throw new UnauthorizedException('Invalid pipeline API key');
    }

    return true;
  }
}

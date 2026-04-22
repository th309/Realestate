import {
  Body,
  Controller,
  HttpCode,
  Logger,
  Post,
  BadRequestException,
} from '@nestjs/common';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AttributionService } from '../content-pipeline/short-links/attribution.service';

/**
 * Request body for POST /api/auth-hooks/on-user-created.
 *
 * Called by the frontend signup form immediately after a Supabase signup
 * returns a session, so we can capture content-pipeline attribution from
 * the `__piq_attr` cookie that /go/[slug] set on first touch.
 *
 * The cookie itself is httpOnly=false (frontend can read it), so the
 * frontend reads `document.cookie` for `__piq_attr` and forwards the
 * raw JSON value to this endpoint.
 */
export class OnUserCreatedDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  cookieValue?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  tierAtSignup?: string;
}

@Controller('api/auth-hooks')
export class OnUserCreatedController {
  private readonly logger = new Logger(OnUserCreatedController.name);

  constructor(private readonly attribution: AttributionService) {}

  @Post('on-user-created')
  @HttpCode(200)
  async onUserCreated(@Body() body: OnUserCreatedDto): Promise<{
    success: true;
  }> {
    if (!body?.userId) {
      throw new BadRequestException('userId is required');
    }

    try {
      await this.attribution.captureFromCookie(
        body.userId,
        body.cookieValue ?? null,
        body.tierAtSignup ?? 'free',
      );
    } catch (err) {
      // Never fail signup because of attribution issues; just log.
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `attribution capture threw for user ${body.userId}: ${message}`,
      );
    }

    return { success: true };
  }
}

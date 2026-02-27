import {
  Controller,
  Post,
  Req,
  RawBodyRequest,
  BadRequestException,
  ServiceUnavailableException,
  Logger,
  HttpCode,
} from '@nestjs/common';
import { Request } from 'express';
import { Webhook } from 'standardwebhooks';
import { ConfigService } from '@nestjs/config';
import { AuthHooksService } from './auth-hooks.service';
import { SupabaseEmailHookPayload } from './auth-hooks.types';

@Controller('api/auth')
export class AuthHooksController {
  private readonly logger = new Logger(AuthHooksController.name);
  private readonly webhook: Webhook | null;

  constructor(
    private readonly authHooksService: AuthHooksService,
    private readonly config: ConfigService,
  ) {
    this.webhook = this.initWebhook();
  }

  /**
   * Supabase provides webhook secrets in the format "v1,whsec_<base64>".
   * The standardwebhooks library expects "whsec_<base64>" (no version prefix).
   * Strip the version prefix before constructing the Webhook.
   */
  private initWebhook(): Webhook | null {
    const raw = this.config.get<string>('SUPABASE_WEBHOOK_SECRET');
    if (!raw) {
      this.logger.warn(
        'SUPABASE_WEBHOOK_SECRET not set — email hook endpoint will be unavailable',
      );
      return null;
    }

    // Strip Supabase version prefix (e.g. "v1,") if present
    const secret = raw.replace(/^v\d+,/, '');

    try {
      const wh = new Webhook(secret);
      this.logger.log('Webhook signature verification initialized');
      return wh;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to initialize webhook verifier: ${message} — email hook endpoint will be unavailable`,
      );
      return null;
    }
  }

  /** Supabase auth email hook — no auth guard (verified by webhook signature) */
  @Post('email-hook')
  @HttpCode(200)
  async handleEmailHook(@Req() req: RawBodyRequest<Request>) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException(
        'Missing raw body — ensure raw body parsing is enabled',
      );
    }

    const headers = {
      'webhook-id': req.headers['webhook-id'] as string,
      'webhook-timestamp': req.headers['webhook-timestamp'] as string,
      'webhook-signature': req.headers['webhook-signature'] as string,
    };

    if (
      !headers['webhook-id'] ||
      !headers['webhook-timestamp'] ||
      !headers['webhook-signature']
    ) {
      throw new BadRequestException('Missing required webhook headers');
    }

    if (!this.webhook) {
      throw new ServiceUnavailableException(
        'Webhook verification is not configured — SUPABASE_WEBHOOK_SECRET is missing or invalid',
      );
    }

    let payload: SupabaseEmailHookPayload;
    try {
      payload = this.webhook.verify(
        rawBody.toString('utf8'),
        headers,
      ) as SupabaseEmailHookPayload;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Webhook signature verification failed: ${message}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    if (!payload?.user?.email || !payload?.email_data?.token_hash) {
      throw new BadRequestException('Malformed webhook payload');
    }

    await this.authHooksService.handleEmailHook(payload);
    return {};
  }
}

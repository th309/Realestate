import {
  Controller,
  Post,
  Req,
  RawBodyRequest,
  BadRequestException,
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
  private readonly webhook: Webhook;

  constructor(
    private readonly authHooksService: AuthHooksService,
    private readonly config: ConfigService,
  ) {
    const secret = this.config.getOrThrow<string>('SUPABASE_WEBHOOK_SECRET');
    this.webhook = new Webhook(secret);
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

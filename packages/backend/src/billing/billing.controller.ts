import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  RawBodyRequest,
  BadRequestException,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';

@Controller('api/billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(
    private readonly billingService: BillingService,
    private readonly stripeService: StripeService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async createCheckoutSession(
    @Body() body: { tier: string; interval: 'month' | 'year'; returnContext?: string },
    @AuthUserId() userId: string,
  ) {
    if (!body.tier || !['pro', 'enterprise'].includes(body.tier)) {
      throw new BadRequestException('Invalid tier');
    }

    if (!body.interval || !['month', 'year'].includes(body.interval)) {
      throw new BadRequestException('Invalid interval');
    }

    const checkoutUrl = await this.billingService.startCheckout(
      userId,
      body.tier,
      body.interval,
      body.returnContext,
    );

    return { checkoutUrl };
  }

  /** Stripe webhook — no auth guard (verified by Stripe signature) */
  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
  ) {
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw body — ensure raw body parsing is enabled');
    }

    let event;
    try {
      event = this.stripeService.constructWebhookEvent(rawBody, signature);
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    await this.billingService.handleWebhookEvent(event);
    return { received: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('portal')
  async getBillingPortal(@AuthUserId() userId: string) {
    const portalUrl = await this.billingService.getBillingPortalUrl(userId);
    return { portalUrl };
  }
}

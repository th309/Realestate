import { Controller, Post, Get, Body, Headers, Req, RawBodyRequest, BadRequestException, Logger } from '@nestjs/common';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import { Request } from 'express';

@Controller('api/billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(
    private readonly billingService: BillingService,
    private readonly stripeService: StripeService,
  ) {}

  @Post('checkout')
  async createCheckoutSession(
    @Body() body: { tier: string; interval: 'month' | 'year'; returnContext?: string },
    @Headers('x-user-id') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('Authentication required');
    }

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

  @Get('portal')
  async getBillingPortal(
    @Headers('x-user-id') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('Authentication required');
    }

    const portalUrl = await this.billingService.getBillingPortalUrl(userId);
    return { portalUrl };
  }
}

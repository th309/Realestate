import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { ReferralsService } from './referrals.service';

class ApplyCodeDto {
  code!: string;
}

@Controller('api/referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  /** Get (or generate) the current user's referral link. */
  @UseGuards(JwtAuthGuard)
  @Get('my-code')
  async getMyCode(@AuthUserId() userId: string) {
    return this.referrals.getOrCreateCode(userId);
  }

  /** Dashboard stats: signups, conversions, credits earned. */
  @UseGuards(JwtAuthGuard)
  @Get('stats')
  async getStats(@AuthUserId() userId: string) {
    return this.referrals.getStats(userId);
  }

  /**
   * Called by the frontend after signup to attribute a referral.
   * The code is read from the piq_ref cookie and passed here.
   */
  @UseGuards(JwtAuthGuard)
  @Post('apply-code')
  async applyCode(
    @AuthUserId() userId: string,
    @Body() body: ApplyCodeDto,
  ) {
    if (!body.code || typeof body.code !== 'string' || body.code.length > 20) {
      throw new BadRequestException('Invalid code');
    }
    return this.referrals.applyReferralCode(userId, body.code.toLowerCase().trim());
  }
}

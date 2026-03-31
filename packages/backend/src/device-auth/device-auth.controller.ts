/**
 * Device Auth Controller
 *
 * Endpoints for the MCP device authorization flow.
 * POST /device-code and GET /device-code/:code are unauthenticated.
 * POST /device-code/verify requires JWT auth (user activating in browser).
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { DeviceAuthService } from './device-auth.service';

@Controller('api/auth/device-code')
export class DeviceAuthController {
  constructor(
    private readonly deviceAuthService: DeviceAuthService,
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  @Post()
  async createDeviceCode() {
    return this.deviceAuthService.createDeviceCode();
  }

  @Get(':code')
  async pollDeviceCode(@Param('code') code: string) {
    return this.deviceAuthService.pollDeviceCode(code);
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  async verifyUserCode(
    @Body('user_code') userCode: string,
    @AuthUserId() userId: string,
  ) {
    // Get user email from Supabase
    const { data: profile } = await this.supabase
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .single();

    const email = profile?.email ?? 'unknown';
    await this.deviceAuthService.verifyUserCode(userCode, userId, email);
    return { success: true, message: 'MCP server connected successfully' };
  }
}

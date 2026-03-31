/**
 * User API Keys Controller
 *
 * Personal API key management for Pro+ users.
 * All routes require JWT authentication.
 *
 * Routes:
 *   GET    /api/user/api-keys       — List active keys (prefix only)
 *   POST   /api/user/api-keys       — Create key (returns full key ONCE)
 *   DELETE /api/user/api-keys/:id   — Revoke key (soft delete)
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { UserApiKeysService } from './user-api-keys.service';
import { CreateUserApiKeyDto } from './dto/create-user-api-key.dto';

const ALLOWED_TIERS = ['pro', 'enterprise', 'admin'];

@Controller('api/user/api-keys')
@UseGuards(JwtAuthGuard)
export class UserApiKeysController {
  constructor(
    private readonly userApiKeysService: UserApiKeysService,
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  @Get()
  async listKeys(@AuthUserId() userId: string) {
    return this.userApiKeysService.listKeys(userId);
  }

  @Post()
  async createKey(
    @AuthUserId() userId: string,
    @Body() dto: CreateUserApiKeyDto,
  ) {
    await this.requireTier(userId, ALLOWED_TIERS);
    return this.userApiKeysService.createKey(userId, dto);
  }

  @Delete(':id')
  async revokeKey(@AuthUserId() userId: string, @Param('id') keyId: string) {
    await this.userApiKeysService.revokeKey(userId, keyId);
    return { success: true };
  }

  private async requireTier(userId: string, allowed: string[]): Promise<void> {
    const { data } = await this.supabase
      .from('user_profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    const tier = data?.subscription_tier ?? 'free';
    if (!allowed.includes(tier)) {
      throw new ForbiddenException(
        `API key creation requires a Pro or Enterprise subscription. Current tier: ${tier}`,
      );
    }
  }
}

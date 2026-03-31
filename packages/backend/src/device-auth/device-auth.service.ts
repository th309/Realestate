/**
 * Device Auth Service
 *
 * Implements device authorization flow for MCP server authentication.
 * Uses Redis to store short-lived device codes (10-min TTL).
 *
 * Flow:
 *   1. MCP server → POST /device-code → gets device_code + user_code
 *   2. User visits /activate, enters user_code
 *   3. Backend verifies, creates personal API key, marks complete
 *   4. MCP server polls GET /device-code/:code → gets API key
 */

import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { RedisService } from '../redis/redis.service';
import { UserApiKeysService } from '../user-api-keys/user-api-keys.service';

interface DeviceCodeEntry {
  userCode: string;
  status: 'pending' | 'complete';
  apiKey?: string;
  userEmail?: string;
}

const DEVICE_CODE_TTL_SECONDS = 600; // 10 minutes
const REDIS_PREFIX = 'device-auth:';
const ALLOWED_TIERS = ['pro', 'enterprise', 'admin'];

@Injectable()
export class DeviceAuthService {
  private readonly logger = new Logger(DeviceAuthService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly redisService: RedisService,
    private readonly userApiKeysService: UserApiKeysService,
  ) {}

  async createDeviceCode(): Promise<{
    device_code: string;
    user_code: string;
    verification_url: string;
    expires_in: number;
  }> {
    const deviceCode = randomBytes(32).toString('hex');
    const userCode = this.generateUserCode();

    const entry: DeviceCodeEntry = {
      userCode,
      status: 'pending',
    };

    // RedisService.setByKey calls JSON.stringify internally — pass the object directly
    await this.redisService.setByKey(
      `${REDIS_PREFIX}${deviceCode}`,
      entry,
      DEVICE_CODE_TTL_SECONDS,
    );

    // Reverse lookup: user_code → device_code (stored as a plain string object)
    await this.redisService.setByKey(
      `${REDIS_PREFIX}code:${userCode}`,
      deviceCode,
      DEVICE_CODE_TTL_SECONDS,
    );

    return {
      device_code: deviceCode,
      user_code: userCode,
      verification_url: 'https://propertyiq.up.railway.app/activate',
      expires_in: DEVICE_CODE_TTL_SECONDS,
    };
  }

  async pollDeviceCode(deviceCode: string): Promise<{
    status: 'pending' | 'complete' | 'expired';
    api_key?: string;
    user_email?: string;
  }> {
    // RedisService.getByKey calls JSON.parse internally — returns the object directly
    const entry = await this.redisService.getByKey(
      `${REDIS_PREFIX}${deviceCode}`,
    ) as DeviceCodeEntry | null;

    if (!entry) {
      return { status: 'expired' };
    }

    if (entry.status === 'complete') {
      // Clean up after successful retrieval (expire in 1 second)
      await this.redisService.setByKey(
        `${REDIS_PREFIX}${deviceCode}`,
        '',
        1,
      );
      return {
        status: 'complete',
        api_key: entry.apiKey,
        user_email: entry.userEmail,
      };
    }

    return { status: 'pending' };
  }

  async verifyUserCode(
    userCode: string,
    userId: string,
    userEmail: string,
  ): Promise<void> {
    // Check user's tier
    const { data: profile } = await this.supabase
      .from('user_profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    const tier = profile?.subscription_tier ?? 'free';
    if (!ALLOWED_TIERS.includes(tier)) {
      throw new ForbiddenException(
        'API access requires a Pro or Enterprise subscription',
      );
    }

    // Look up device_code from user_code (stored as a plain string, JSON.parse returns it as-is)
    const deviceCode = await this.redisService.getByKey(
      `${REDIS_PREFIX}code:${userCode}`,
    ) as string | null;

    if (!deviceCode) {
      throw new BadRequestException('Invalid or expired activation code');
    }

    const entry = await this.redisService.getByKey(
      `${REDIS_PREFIX}${deviceCode}`,
    ) as DeviceCodeEntry | null;

    if (!entry) {
      throw new BadRequestException('Invalid or expired activation code');
    }

    if (entry.userCode !== userCode) {
      throw new BadRequestException('Invalid activation code');
    }

    // Create a personal API key for MCP
    const keyResult = await this.userApiKeysService.createKey(userId, {
      name: 'MCP Server (auto-provisioned)',
      scopes: ['scores:read', 'metrics:read', 'rankings:read'],
      rate_limit_rpm: 120,
    });

    // Mark device code as complete with the API key
    const updated: DeviceCodeEntry = {
      ...entry,
      status: 'complete',
      apiKey: keyResult.key,
      userEmail,
    };

    await this.redisService.setByKey(
      `${REDIS_PREFIX}${deviceCode}`,
      updated,
      DEVICE_CODE_TTL_SECONDS,
    );
  }

  private generateUserCode(): string {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I, O (ambiguous)
    const digits = '0123456789';
    const bytes = randomBytes(8);
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += letters[bytes[i] % letters.length];
    }
    code += '-';
    for (let i = 4; i < 8; i++) {
      code += digits[bytes[i] % digits.length];
    }
    return code;
  }
}

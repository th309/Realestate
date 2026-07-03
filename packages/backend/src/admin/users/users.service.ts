import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { RedisService } from '../../redis/redis.service';
import { UserFeaturesService } from '../features/user-features.service';
import { UserDetail, UserListItem, UserStats } from './users.types';
import { fetchUsersList, fetchOrganizationsList } from './users-list.helper';
import { fetchUserDetail, fetchUserStats } from './users-detail.helper';
import { createAdminUser, applyUserTierUpdate } from './users-mutations.helper';
import {
  deleteOrganizationCascade,
  deleteUserCascade,
} from './users-deletion.helper';

export type { UserListItem, UserDetail, UserStats } from './users.types';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly userFeatures: UserFeaturesService,
    private readonly redis: RedisService,
  ) {}

  async getUsers(options?: {
    search?: string;
    tier?: string;
    organizationId?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ users: UserListItem[]; total: number }> {
    return fetchUsersList(this.supabase.getClient(), this.logger, options);
  }

  async listOrganizations(): Promise<{
    organizations: { id: string; name: string; slug: string }[];
  }> {
    return fetchOrganizationsList(this.supabase.getClient());
  }

  async getUserDetail(userId: string): Promise<UserDetail | null> {
    return fetchUserDetail(
      this.supabase.getClient(),
      this.userFeatures,
      userId,
    );
  }

  async getStats(): Promise<UserStats> {
    return fetchUserStats(this.supabase.getClient());
  }

  async addOverride(
    userId: string,
    featureSlug: string,
    options?: {
      reason?: string;
      expiresAt?: string;
      grantedBy?: string;
    },
  ): Promise<void> {
    await this.userFeatures.createOverride(userId, featureSlug, true, {
      reason: options?.reason,
      expiresAt: options?.expiresAt,
      grantedBy: options?.grantedBy,
    });
  }

  async removeOverride(userId: string, featureSlug: string): Promise<void> {
    await this.userFeatures.removeOverride(userId, featureSlug);
  }

  async createUser(params: {
    email: string;
    password: string;
    fullName?: string;
    tier?: string;
  }): Promise<{ id: string; email: string }> {
    return createAdminUser(this.supabase.getClient(), this.logger, params);
  }

  async updateUserTier(userId: string, tier: string): Promise<void> {
    await applyUserTierUpdate(
      this.supabase.getClient(),
      this.redis,
      this.logger,
      userId,
      tier,
    );
  }

  async deleteOrganization(orgId: string): Promise<void> {
    await deleteOrganizationCascade(
      this.supabase.getClient(),
      this.logger,
      orgId,
    );
  }

  async deleteUser(userId: string): Promise<void> {
    await deleteUserCascade(this.supabase.getClient(), this.logger, userId);
  }
}

/**
 * Grandfathering Service
 *
 * Manages grandfathered pricing and features for users.
 * Includes policy engine for automatic grandfathering on tier changes.
 *
 * Implementation is split across:
 *  - grandfathering.types.ts               (shared interfaces)
 *  - grandfathering-records.helper.ts      (record CRUD + audit log)
 *  - grandfathering-policies.helper.ts     (policy CRUD)
 *  - grandfathering-policy-engine.helper.ts (automatic policy application)
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  CreateGrandfatherDto,
  GrandfatheredRecord,
  GrandfatherPolicy,
} from './grandfathering.types';
import {
  createGrandfathering,
  extendGrandfathering,
  getAllActiveGrandfathering,
  getUserGrandfathering,
  revokeGrandfathering,
} from './grandfathering-records.helper';
import {
  createPolicy,
  deletePolicy,
  getActivePolicies,
  getPolicies,
  updatePolicy,
} from './grandfathering-policies.helper';
import {
  applyPoliciesOnPriceIncrease,
  applyPoliciesOnTierChange,
} from './grandfathering-policy-engine.helper';

// Re-export types for backward compatibility with existing importers.
export type {
  CreateGrandfatherDto,
  GrandfatheredRecord,
  GrandfatherPolicy,
} from './grandfathering.types';

@Injectable()
export class GrandfatheringService {
  private readonly logger = new Logger(GrandfatheringService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // ========================================================================
  // GRANDFATHERED RECORDS
  // ========================================================================

  /**
   * Get all grandfathered records for a user
   */
  async getUserGrandfathering(userId: string): Promise<GrandfatheredRecord[]> {
    return getUserGrandfathering(
      this.supabase.getClient(),
      this.logger,
      userId,
    );
  }

  /**
   * Get all active grandfathered records (admin)
   */
  async getAllActiveGrandfathering(): Promise<GrandfatheredRecord[]> {
    return getAllActiveGrandfathering(this.supabase.getClient());
  }

  /**
   * Create a grandfathered record
   */
  async createGrandfathering(
    dto: CreateGrandfatherDto,
  ): Promise<GrandfatheredRecord> {
    return createGrandfathering(this.supabase.getClient(), this.logger, dto);
  }

  /**
   * Revoke a grandfathered record
   */
  async revokeGrandfathering(
    grandfatherId: string,
    revokedBy?: string,
    reason?: string,
  ): Promise<void> {
    return revokeGrandfathering(
      this.supabase.getClient(),
      this.logger,
      grandfatherId,
      revokedBy,
      reason,
    );
  }

  /**
   * Extend grandfathering expiration
   */
  async extendGrandfathering(
    grandfatherId: string,
    newExpiresAt: string,
  ): Promise<void> {
    return extendGrandfathering(
      this.supabase.getClient(),
      this.logger,
      grandfatherId,
      newExpiresAt,
    );
  }

  // ========================================================================
  // POLICY ENGINE
  // ========================================================================

  /**
   * Get all grandfathering policies
   */
  async getPolicies(): Promise<GrandfatherPolicy[]> {
    return getPolicies(this.supabase.getClient());
  }

  /**
   * Get active policies
   */
  async getActivePolicies(): Promise<GrandfatherPolicy[]> {
    return getActivePolicies(this.supabase.getClient());
  }

  /**
   * Apply policies on tier change
   */
  async applyPoliciesOnTierChange(
    userId: string,
    fromTier: string,
    toTier: string,
    grantedBy?: string,
  ): Promise<GrandfatheredRecord[]> {
    return applyPoliciesOnTierChange(
      this.supabase.getClient(),
      this.logger,
      userId,
      fromTier,
      toTier,
      grantedBy,
    );
  }

  /**
   * Apply policies on price increase
   */
  async applyPoliciesOnPriceIncrease(
    tierSlug: string,
    oldPrice: number,
    newPrice: number,
  ): Promise<number> {
    return applyPoliciesOnPriceIncrease(
      this.supabase.getClient(),
      this.logger,
      tierSlug,
      oldPrice,
      newPrice,
    );
  }

  /**
   * Create a new policy
   */
  async createPolicy(
    policy: Omit<GrandfatherPolicy, 'id'>,
  ): Promise<GrandfatherPolicy> {
    return createPolicy(this.supabase.getClient(), this.logger, policy);
  }

  /**
   * Update a policy
   */
  async updatePolicy(
    policyId: string,
    updates: Partial<GrandfatherPolicy>,
  ): Promise<GrandfatherPolicy> {
    return updatePolicy(this.supabase.getClient(), policyId, updates);
  }

  /**
   * Delete a policy
   */
  async deletePolicy(policyId: string): Promise<void> {
    return deletePolicy(this.supabase.getClient(), this.logger, policyId);
  }
}

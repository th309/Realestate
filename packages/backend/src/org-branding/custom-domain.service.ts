/**
 * Custom Domain Service
 *
 * Manages custom subdomain configuration for enterprise organizations.
 * Supports setting a domain, verifying DNS CNAME records, and removing domains.
 *
 * Flow:
 *   1. Org admin sets a custom subdomain (e.g., analytics.acmerealty.com)
 *   2. Backend returns the CNAME target (propertyiq.up.railway.app)
 *   3. Admin configures DNS with their registrar
 *   4. Admin clicks "Verify" — backend resolves CNAME and checks it points to us
 *   5. On success, domain status is marked 'active'
 */

import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import * as dns from 'dns';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

const CNAME_TARGET = 'propertyiq.up.railway.app';

/**
 * Validates a fully-qualified domain name.
 * Allows subdomains like analytics.acmerealty.com but rejects bare labels
 * and invalid characters.
 */
const DOMAIN_PATTERN =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

@Injectable()
export class CustomDomainService {
  private readonly logger = new Logger(CustomDomainService.name);
  private readonly dnsResolver = dns.promises;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Set a custom subdomain for an organization.
   *
   * Validates domain format, saves to DB with 'pending' status,
   * and returns the CNAME target the admin must configure.
   */
  async setDomain(
    orgId: string,
    subdomain: string,
  ): Promise<{ cname_target: string }> {
    const normalized = subdomain.trim().toLowerCase();

    if (!DOMAIN_PATTERN.test(normalized)) {
      throw new BadRequestException(
        'Invalid domain format. Must be a valid FQDN (e.g., analytics.acmerealty.com)',
      );
    }

    const { error } = await this.supabase
      .from('organizations')
      .update({
        custom_subdomain: normalized,
        custom_domain_status: 'pending',
        custom_domain_verified_at: null,
      })
      .eq('id', orgId);

    if (error) {
      this.logger.error(
        `Failed to set custom domain for org ${orgId}: ${error.message}`,
      );
      throw new BadRequestException('Failed to save custom domain');
    }

    this.logger.log(
      `Custom domain set for org ${orgId}: ${normalized} (pending verification)`,
    );

    return { cname_target: CNAME_TARGET };
  }

  /**
   * Verify that the organization's custom subdomain has a CNAME record
   * pointing to the PropertyIQ Railway deployment.
   *
   * On success, marks the domain as 'active' with a verification timestamp.
   */
  async verifyDomain(
    orgId: string,
  ): Promise<{ verified: boolean; error?: string }> {
    const { data: org, error: fetchError } = await this.supabase
      .from('organizations')
      .select('custom_subdomain')
      .eq('id', orgId)
      .single();

    if (fetchError || !org) {
      this.logger.error(
        `Failed to fetch org ${orgId} for domain verification: ${fetchError?.message}`,
      );
      throw new BadRequestException('Organization not found');
    }

    if (!org.custom_subdomain) {
      throw new BadRequestException('No custom domain configured');
    }

    try {
      const records = await this.dnsResolver.resolveCname(org.custom_subdomain);
      const pointsToUs = records.some(
        (record: string) =>
          record.includes('railway.app') || record.includes('propertyiq'),
      );

      if (pointsToUs) {
        await this.supabase
          .from('organizations')
          .update({
            custom_domain_status: 'active',
            custom_domain_verified_at: new Date().toISOString(),
          })
          .eq('id', orgId);

        this.logger.log(
          `Custom domain verified for org ${orgId}: ${org.custom_subdomain}`,
        );

        return { verified: true };
      }

      return {
        verified: false,
        error: `CNAME points to ${records[0]} — should point to ${CNAME_TARGET}`,
      };
    } catch (err) {
      this.logger.warn(
        `DNS lookup failed for ${org.custom_subdomain}: ${String(err)}`,
      );

      return {
        verified: false,
        error:
          'DNS record not found. Please add the CNAME record and wait a few minutes for propagation.',
      };
    }
  }

  /**
   * Remove the custom domain configuration for an organization.
   * Resets subdomain, status, and verification timestamp.
   */
  async removeDomain(orgId: string): Promise<void> {
    const { error } = await this.supabase
      .from('organizations')
      .update({
        custom_subdomain: null,
        custom_domain_status: 'pending',
        custom_domain_verified_at: null,
      })
      .eq('id', orgId);

    if (error) {
      this.logger.error(
        `Failed to remove custom domain for org ${orgId}: ${error.message}`,
      );
      throw new BadRequestException('Failed to remove custom domain');
    }

    this.logger.log(`Custom domain removed for org ${orgId}`);
  }
}

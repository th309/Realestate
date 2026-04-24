import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { McpEntitlementsInvalidator } from './mcp-entitlements-invalidator.service';

/**
 * Dedicated module for the MCP entitlements cache invalidator.
 *
 * Kept separate from EntitlementsModule because (a) the invalidator only
 * needs SUPABASE_CLIENT, and (b) downstream consumers (BillingModule,
 * OrgBillingModule, OrganizationsModule) would otherwise transitively
 * import Redis, features, user-analytics, and a forwardRef'd OrgBillingModule
 * that raises cycle risk. This tiny module has exactly one provider.
 */
@Module({
  imports: [SupabaseModule],
  providers: [McpEntitlementsInvalidator],
  exports: [McpEntitlementsInvalidator],
})
export class McpEntitlementsInvalidatorModule {}

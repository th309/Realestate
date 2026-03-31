/**
 * Platform API v1 — Watchlist Controller
 *
 * Org-scoped watchlist operations. Unlike the user-facing watchlist
 * (per-user), Platform API watchlist endpoints aggregate across all
 * active members of the org and use the org owner for writes.
 *
 * Endpoints:
 *   GET    /api/v1/watchlist      — List all watchlist items across org members
 *   POST   /api/v1/watchlist      — Add item (using org owner's user context)
 *   DELETE /api/v1/watchlist/:id  — Remove item (must belong to an org member)
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  Inject,
  UseGuards,
  UseInterceptors,
  HttpException,
  HttpStatus,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { ApiKeyAuthGuard } from '../../org-api-keys/api-key-auth.guard';
import { ApiKeyValidatorService } from '../../org-api-keys/api-key-validator.service';
import { ApiThrottleGuard } from '../api-throttle.guard';
import { ApiResponseInterceptor } from '../api-response.interceptor';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';

// ── Request body ─────────────────────────────────────────────────────────

interface AddWatchlistBody {
  geography_level: string;
  geography_id: string;
  geography_name?: string;
  tags?: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Get active member user IDs for an org. */
async function getOrgMemberUserIds(
  supabase: SupabaseClient,
  orgId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', orgId)
    .eq('status', 'active');

  if (error) {
    throw new HttpException(
      { code: 'ORG_LOOKUP_FAILED', message: 'Failed to look up org members' },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  return (data ?? []).map((m) => m.user_id);
}

/** Resolve the org owner user ID from the organizations table. */
async function getOrgOwnerId(
  supabase: SupabaseClient,
  orgId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('organizations')
    .select('owner_id')
    .eq('id', orgId)
    .single();

  if (error || !data?.owner_id) {
    throw new HttpException(
      { code: 'ORG_NOT_FOUND', message: 'Organization not found' },
      HttpStatus.NOT_FOUND,
    );
  }

  return data.owner_id;
}

// ── Controller ───────────────────────────────────────────────────────────

@Controller('api/v1/watchlist')
@UseGuards(ApiKeyAuthGuard, ApiThrottleGuard)
@UseInterceptors(ApiResponseInterceptor)
export class PlatformWatchlistController {
  private readonly logger = new Logger(PlatformWatchlistController.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly apiKeyValidator: ApiKeyValidatorService,
  ) {}

  /**
   * GET /api/v1/watchlist
   *
   * List all watchlist items across every active member of the org.
   */
  @Get()
  async findAll(@Req() req: any) {
    const { orgId, userId, scopes, source } = req.apiKeyOrg;
    this.apiKeyValidator.checkScope(scopes, 'watchlist:read');

    const userIds =
      source === 'user'
        ? [userId]
        : await getOrgMemberUserIds(this.supabase, orgId);

    if (userIds.length === 0) {
      return { items: [], count: 0 };
    }

    const { data, error } = await this.supabase
      .from('analytics_watchlist')
      .select('*')
      .in('user_id', userIds)
      .order('added_at', { ascending: false });

    if (error) {
      this.logger.error(
        `Failed to list watchlist for org ${orgId}: ${error.message}`,
      );
      throw new HttpException(
        { code: 'LIST_FAILED', message: 'Failed to list watchlist items' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const items = data ?? [];
    return { items, count: items.length };
  }

  /**
   * POST /api/v1/watchlist
   *
   * Add a geography to the org-level watchlist. Uses the org owner's
   * user context since the Platform API has no individual user identity.
   */
  @Post()
  async create(@Req() req: any, @Body() body: AddWatchlistBody) {
    const { orgId, userId, scopes, source } = req.apiKeyOrg;
    this.apiKeyValidator.checkScope(scopes, 'watchlist:write');

    if (!body.geography_level || !body.geography_id) {
      throw new HttpException(
        {
          code: 'INVALID_INPUT',
          message: 'geography_level and geography_id are required',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const ownerId =
      source === 'user' ? userId : await getOrgOwnerId(this.supabase, orgId);

    const { data, error } = await this.supabase
      .from('analytics_watchlist')
      .insert({
        user_id: ownerId,
        geography_type: body.geography_level,
        geography_id: body.geography_id,
        geography_name: body.geography_name ?? null,
        tags: body.tags ?? null,
      })
      .select()
      .single();

    if (error) {
      // Handle duplicate entry
      if (error.code === '23505') {
        throw new HttpException(
          {
            code: 'DUPLICATE_ENTRY',
            message: 'This geography is already on the watchlist',
          },
          HttpStatus.CONFLICT,
        );
      }
      this.logger.error(`Failed to add watchlist item: ${error.message}`);
      throw new HttpException(
        { code: 'INSERT_FAILED', message: 'Failed to add watchlist item' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.log(
      `API watchlist add: org=${orgId} geo=${body.geography_level}/${body.geography_id}`,
    );

    return data;
  }

  /**
   * DELETE /api/v1/watchlist/:id
   *
   * Remove a watchlist item by its ID. The item must belong to an active
   * member of the requesting org.
   */
  @Delete(':id')
  async remove(@Req() req: any, @Param('id') itemId: string) {
    const { orgId, userId, scopes, source } = req.apiKeyOrg;
    this.apiKeyValidator.checkScope(scopes, 'watchlist:write');

    // Verify the item belongs to the user or an org member
    const userIds =
      source === 'user'
        ? [userId]
        : await getOrgMemberUserIds(this.supabase, orgId);

    if (userIds.length === 0) {
      throw new HttpException(
        { code: 'ITEM_NOT_FOUND', message: 'Watchlist item not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    const { data: item, error: fetchError } = await this.supabase
      .from('analytics_watchlist')
      .select('id, user_id')
      .eq('id', itemId)
      .single();

    if (fetchError || !item) {
      throw new HttpException(
        { code: 'ITEM_NOT_FOUND', message: 'Watchlist item not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (!userIds.includes(item.user_id)) {
      throw new HttpException(
        { code: 'ITEM_NOT_FOUND', message: 'Watchlist item not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    const { error: deleteError } = await this.supabase
      .from('analytics_watchlist')
      .delete()
      .eq('id', itemId);

    if (deleteError) {
      this.logger.error(
        `Failed to delete watchlist item ${itemId}: ${deleteError.message}`,
      );
      throw new HttpException(
        { code: 'DELETE_FAILED', message: 'Failed to delete watchlist item' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.log(`API watchlist remove: org=${orgId} item=${itemId}`);

    return { deleted: true };
  }
}

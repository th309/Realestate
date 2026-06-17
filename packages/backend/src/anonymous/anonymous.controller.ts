import {
  Body,
  Controller,
  Logger,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  AuthedGeneratePresentationDto,
  GeneratePresentationDto,
} from './dto/generate-presentation.dto';
import { SignUpWithTourDto, ClaimDto } from './dto/sign-up-with-tour.dto';
import {
  ListingPresentationService,
  GeoLevel,
} from './listing-presentation.service';
import { RedisTourCacheService } from './redis-tour-cache.service';
import { ListingPresentationClaimService } from './listing-presentation-claim.service';
import { AnonRateLimitGuard } from './anon-rate-limit.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SupabaseService } from '../supabase/supabase.service';
import { MarketsService } from '../markets/markets.service';

@Controller('api/anonymous')
export class AnonymousController {
  private logger = new Logger(AnonymousController.name);

  constructor(
    private listing: ListingPresentationService,
    private cache: RedisTourCacheService,
    private claimService: ListingPresentationClaimService,
    private supabaseService: SupabaseService,
    private markets: MarketsService,
  ) {}

  // NOTE: A parallel agent is editing listing-presentation.service.ts (T9
  // orchestrator fix). To avoid merge conflicts we keep cache row assembly
  // here in the controller for now — the small coupling cost is intentional.
  // Move createdAt + claimedBy defaults into the service in a follow-up once
  // that work has landed.
  @Post('listing-presentation')
  @UseGuards(AnonRateLimitGuard)
  async generate(@Body() dto: GeneratePresentationDto) {
    // DTO validates geoLevel via @IsIn(['metro','county','city','zip']),
    // so the narrow at this boundary is safe.
    const result = await this.listing.generate({
      sessionId: dto.sessionId,
      persona: dto.persona,
      market: {
        geoLevel: dto.market.geoLevel as GeoLevel,
        geoId: dto.market.geoId,
        name: dto.market.name,
      },
    });

    // Best-effort cache write. If Redis is down or rejects, the user still
    // gets the report — they have the client-side payload and can re-claim
    // later by re-submitting the same sessionId. Failing the request would
    // burn their once-per-day rate-limit slot AND lose the report. Worse UX.
    try {
      await this.cache.set({
        sessionId: result.sessionId,
        reportId: result.reportId,
        persona: dto.persona,
        market: dto.market,
        reportPayload: result.report,
        createdAt: new Date().toISOString(),
        expiresAt: result.expiresAt,
        claimedBy: null,
      });
    } catch (err) {
      this.logger.warn(
        `Cache.set failed for session ${result.sessionId}; report still returned to client. error=${String(err)}`,
      );
    }

    return result;
  }

  /**
   * Authenticated report generation — same 10-section listing presentation, but
   * for a signed-in user. Differs from the anonymous endpoint on three counts
   * that all break authed callers (e.g. the tour aha-finale on a hard nav):
   *
   *   1. No `AnonRateLimitGuard` — authed users own their report; the 1/IP/24h
   *      anon limit (and its bot-UA block) must not apply.
   *   2. The DTO `name` is OPTIONAL. A bare-URL market (`metro-39580`) carries
   *      an empty name, so we resolve the display name server-side from
   *      `MarketsService.getMarketCore(geoLevel, geoId)`.
   *   3. No best-effort Redis cache write — the report is rendered client-side
   *      for the authed user and (when they claim) persisted via the claim flow.
   *
   * `JwtAuthGuard` sets `request.userId`; the guard already rejects missing /
   * invalid Bearer tokens, so reaching the handler implies an authenticated user.
   */
  @Post('listing-presentation/authenticated')
  @UseGuards(JwtAuthGuard)
  async generateAuthenticated(@Body() dto: AuthedGeneratePresentationDto) {
    // Resolve the display name server-side when the client didn't supply one
    // (bare-URL market entries leave it empty). getMarketCore returns null for
    // unknown geographies — fall back to a readable id-based label so the
    // report header is never blank.
    let name = dto.market.name?.trim() ?? '';
    if (!name) {
      const core = await this.markets
        .getMarketCore({
          geoLevel: dto.market.geoLevel,
          geoId: dto.market.geoId,
        })
        .catch(() => null);
      name = core?.name?.trim() || dto.market.geoId;
    }

    return this.listing.generate({
      sessionId: dto.sessionId,
      persona: dto.persona,
      market: {
        geoLevel: dto.market.geoLevel as GeoLevel,
        geoId: dto.market.geoId,
        name,
      },
    });
  }

  /**
   * Atomically creates a Supabase auth user and claims the anonymous tour
   * session into a permanent reports row. In dev (`NODE_ENV !== 'production'`)
   * the user is auto-confirmed and a magic link is returned for the frontend
   * to install a session immediately. In prod the email-confirm flow runs
   * and the actual claim happens later in the auth callback.
   */
  @Post('sign-up-with-tour')
  async signUpWithTour(@Body() dto: SignUpWithTourDto) {
    const admin = this.supabaseService.getClient();

    const isProd = process.env.NODE_ENV === 'production';

    const { data: created, error: signUpErr } =
      await admin.auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: !isProd,
      });
    if (signUpErr || !created?.user) {
      throw new UnauthorizedException(signUpErr?.message ?? 'Sign-up failed');
    }

    const userId = created.user.id;

    let reportId: string | null = null;
    try {
      const claim = await this.claimService.claim({
        sessionId: dto.tourSessionId,
        userId,
      });
      reportId = claim?.reportId ?? null;
    } catch (err) {
      // Don't fail the signup if the claim fails — the user account is
      // created; they can re-claim from the dashboard. Log and continue.
      this.logger.warn(
        `Claim failed for user ${userId} session ${dto.tourSessionId}: ${String(err)}`,
      );
    }

    let magicLink: string | null = null;
    if (!isProd) {
      const { data: linkData } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: dto.email,
      });
      magicLink = linkData?.properties?.action_link ?? null;
    }

    return {
      userId,
      reportId,
      needsEmailConfirmation: isProd,
      magicLink,
    };
  }

  /**
   * Standalone claim endpoint — used by the auth-callback page after an
   * email-confirm flow lands the user. Requires a valid Bearer JWT;
   * `JwtAuthGuard` sets `request.userId`.
   */
  @Post('claim')
  @UseGuards(JwtAuthGuard)
  async claim(@Body() dto: ClaimDto, @Req() req: { userId?: string }) {
    const userId = req.userId;
    if (!userId) throw new UnauthorizedException('Authentication required');
    const result = await this.claimService.claim({
      sessionId: dto.tourSessionId,
      userId,
    });
    return { claimed: !!result, reportId: result?.reportId ?? null };
  }
}

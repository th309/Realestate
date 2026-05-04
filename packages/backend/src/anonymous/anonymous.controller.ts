import {
  Body,
  Controller,
  Logger,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { GeneratePresentationDto } from './dto/generate-presentation.dto';
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

@Controller('api/anonymous')
export class AnonymousController {
  private logger = new Logger(AnonymousController.name);

  constructor(
    private listing: ListingPresentationService,
    private cache: RedisTourCacheService,
    private claimService: ListingPresentationClaimService,
    private supabaseService: SupabaseService,
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

/**
 * Embed Token Guard
 *
 * Authenticates embed widget requests using query-string tokens.
 * When a valid `?token=emb_xxx` is present, validates against the
 * organization_embed_tokens table and sets `request.embedOrg` with
 * branding info. When no token is provided, allows the request
 * through for backwards-compatible public embed access.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { OrgEmbedsService } from './org-embeds.service';

@Injectable()
export class EmbedTokenGuard implements CanActivate {
  private readonly logger = new Logger(EmbedTokenGuard.name);

  constructor(private readonly embedsService: OrgEmbedsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.query?.token as string;

    if (!token) {
      this.logger.warn('Embed request rejected: no token provided');
      return false;
    }

    const origin = request.headers?.origin || request.headers?.referer || '';
    const widgetType = this.deriveWidgetType(request.path);

    const result = await this.embedsService.validateToken(
      token,
      origin,
      widgetType,
    );

    request.embedOrg = result;
    return true;
  }

  /**
   * Derive the widget type from the URL path for permission checking.
   */
  private deriveWidgetType(path: string): string {
    if (path.includes('/embed/score/')) return 'score';
    if (path.includes('/embed/metric-card/')) return 'metric_card';
    if (path.includes('/embed/map/')) return 'map';
    if (path.includes('/embed/branding')) return 'score'; // Any type works
    return 'unknown';
  }
}

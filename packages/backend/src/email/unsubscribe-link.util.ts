import { ConfigService } from '@nestjs/config';
import { getEmailLinkBaseUrl } from './email-link-base';
import {
  signUnsubscribeToken,
  type UnsubscribeStream,
} from './unsubscribe-token.util';

/**
 * Builds the per-recipient one-click unsubscribe URL and the matching
 * `List-Unsubscribe` headers for a lifecycle / marketing email.
 *
 * The URL targets the same-origin `/backend` proxy
 * (`app/backend/[[...path]]/route.ts`), which forwards both GET (footer click →
 * branded HTML) and POST (mailbox-provider one-click, body included) to the
 * backend's public `UnsubscribeController`. Using the proxy keeps the link
 * first-party (ad-blocker resilient) and reuses the established data-path
 * architecture rather than exposing the cross-site backend host in emails.
 *
 * Returns `null` when JWT_SECRET is not configured — callers fall back to the
 * plain account-preferences link and simply omit the List-Unsubscribe headers
 * (the email still sends; it just lacks one-click opt-out for that send).
 */
export function buildUnsubscribe(
  config: ConfigService,
  userId: string,
  stream: UnsubscribeStream = 'marketing',
): { url: string; headers: Record<string, string> } | null {
  const secret = config.get<string>('JWT_SECRET');
  if (!secret) return null;

  const token = signUnsubscribeToken(userId, stream, secret);
  const url = `${getEmailLinkBaseUrl(config)}/backend/api/email/unsubscribe?token=${token}`;

  return {
    url,
    headers: {
      'List-Unsubscribe': `<${url}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

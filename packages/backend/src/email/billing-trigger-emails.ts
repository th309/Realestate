import { TRIAL_WILL_END_EMAIL } from '@propertyiq/emails';
import { wrapEmail } from './behavioral-trigger-emails';

export function buildTrialWillEndEmail(
  name: string,
  amountLabel: string,
  chargeDateLabel: string,
  manageUrl: string,
  unsubscribeUrl: string,
): string {
  const body = `
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:#1A237E;">${TRIAL_WILL_END_EMAIL.heading(name)}</h1>
    <p style="margin:0 0 16px; font-size:16px; color:#424242; line-height:1.6;">
      ${TRIAL_WILL_END_EMAIL.intro}
    </p>
    <p style="margin:0 0 16px; font-size:16px; color:#424242; line-height:1.6;">
      On <strong>${chargeDateLabel}</strong>, your card will be charged <strong>${amountLabel}</strong> for PropertyIQ Pro (billed monthly).
    </p>
    <p style="margin:0 0 24px; font-size:16px; color:#424242; line-height:1.6;">
      ${TRIAL_WILL_END_EMAIL.body}
    </p>
    <a href="${manageUrl}"
       style="display:inline-block; background-color:#3949AB; color:#ffffff; padding:14px 28px; border-radius:100px; font-size:15px; font-weight:600; text-decoration:none; letter-spacing:0.2px;">
      ${TRIAL_WILL_END_EMAIL.cta}
    </a>
    <p style="margin:16px 0 0; font-size:13px; color:#757575;">
      ${TRIAL_WILL_END_EMAIL.footnote}
    </p>
  `;
  return wrapEmail(body, unsubscribeUrl);
}

/**
 * buildPaymentFailedEmail — transactional notice sent when Stripe reports
 * invoice.payment_failed on a subscription. Mirrors buildTrialWillEndEmail's
 * wrapper/branding; deliberately not gated on marketing opt-out.
 */
export function buildPaymentFailedEmail(
  name: string,
  updateCardUrl: string,
  unsubscribeUrl: string,
): string {
  const body = `
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:#1A237E;">Hi ${name},</h1>
    <p style="margin:0 0 16px; font-size:16px; color:#424242; line-height:1.6;">
      Your PropertyIQ payment didn't go through. Update your card to keep your Pro access.
    </p>
    <p style="margin:0 0 24px; font-size:16px; color:#424242; line-height:1.6;">
      We'll automatically retry the charge, but updating your card now is the fastest way to avoid any interruption to your Pro features.
    </p>
    <a href="${updateCardUrl}"
       style="display:inline-block; background-color:#3949AB; color:#ffffff; padding:14px 28px; border-radius:100px; font-size:15px; font-weight:600; text-decoration:none; letter-spacing:0.2px;">
      Update Payment Method
    </a>
  `;
  return wrapEmail(body, unsubscribeUrl);
}

import {
  SCORE_DESCRIPTION,
  WELCOME_EMAIL,
  REPORT_GENERATED_EMAIL,
  PAYWALL_HIT_EMAIL,
  POST_TRIAL_7D_EMAIL,
  INACTIVE_24H_EMAIL,
  TRIAL_DAY10_EMAIL,
  TRIAL_DAY13_EMAIL,
  TRIAL_EXPIRED_EMAIL,
  TRIAL_WILL_END_EMAIL,
  ACTIVE_EXPLORER_EMAIL,
} from '@propertyiq/emails';

const BASE_STYLES =
  "font-family: Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #FAFBFF; margin: 0; padding: 0;";

function wrapEmail(body: string, unsubscribeUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="${BASE_STYLES}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAFBFF; padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; box-shadow:0 1px 4px rgba(0,0,0,0.08); overflow:hidden; max-width:600px; width:100%;">
          <tr>
            <td style="background-color:#3949AB; padding:24px 32px;">
              <span style="color:#ffffff; font-size:22px; font-weight:700; letter-spacing:-0.5px;">PropertyIQ</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px; border-top:1px solid #E8EAF6;">
              <p style="margin:0; font-size:12px; color:#9E9E9E;">
                You're receiving this because you have a PropertyIQ account.
                <a href="${unsubscribeUrl}" style="color:#3949AB; text-decoration:none;">Manage notifications</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildInactive24hEmail(
  name: string,
  dashboardUrl: string,
  unsubscribeUrl: string,
): string {
  const body = `
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:#1A237E;">${INACTIVE_24H_EMAIL.heading(name)}</h1>
    <p style="margin:0 0 16px; font-size:16px; color:#424242; line-height:1.6;">
      ${INACTIVE_24H_EMAIL.intro}
    </p>
    <p style="margin:0 0 24px; font-size:16px; color:#424242; line-height:1.6;">
      ${INACTIVE_24H_EMAIL.body}
    </p>
    <a href="${dashboardUrl}"
       style="display:inline-block; background-color:#3949AB; color:#ffffff; padding:14px 28px; border-radius:100px; font-size:15px; font-weight:600; text-decoration:none; letter-spacing:0.2px;">
      ${INACTIVE_24H_EMAIL.cta}
    </a>
  `;
  return wrapEmail(body, unsubscribeUrl);
}

export function buildTrialDay10Email(
  name: string,
  upgradeUrl: string,
  unsubscribeUrl: string,
): string {
  const body = `
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:#1A237E;">${TRIAL_DAY10_EMAIL.heading(name)}</h1>
    <p style="margin:0 0 16px; font-size:16px; color:#424242; line-height:1.6;">
      ${TRIAL_DAY10_EMAIL.intro}
    </p>
    <ul style="margin:0 0 16px; padding-left:20px; font-size:15px; color:#424242; line-height:1.8;">
      ${TRIAL_DAY10_EMAIL.bullets.map((item) => `<li>${item}</li>`).join('\n      ')}
    </ul>
    <p style="margin:0 0 24px; font-size:16px; color:#424242; line-height:1.6;">
      ${TRIAL_DAY10_EMAIL.closing}
    </p>
    <a href="${upgradeUrl}"
       style="display:inline-block; background-color:#3949AB; color:#ffffff; padding:14px 28px; border-radius:100px; font-size:15px; font-weight:600; text-decoration:none; letter-spacing:0.2px;">
      ${TRIAL_DAY10_EMAIL.cta}
    </a>
  `;
  return wrapEmail(body, unsubscribeUrl);
}

export function buildTrialDay13Email(
  name: string,
  upgradeUrl: string,
  unsubscribeUrl: string,
): string {
  const body = `
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:#1A237E;">${TRIAL_DAY13_EMAIL.heading(name)}</h1>
    <p style="margin:0 0 16px; font-size:16px; color:#424242; line-height:1.6;">
      ${TRIAL_DAY13_EMAIL.intro}
    </p>
    <p style="margin:0 0 24px; font-size:16px; color:#424242; line-height:1.6;">
      ${TRIAL_DAY13_EMAIL.body}
    </p>
    <a href="${upgradeUrl}"
       style="display:inline-block; background-color:#3949AB; color:#ffffff; padding:14px 28px; border-radius:100px; font-size:15px; font-weight:600; text-decoration:none; letter-spacing:0.2px;">
      ${TRIAL_DAY13_EMAIL.cta}
    </a>
    <p style="margin:16px 0 0; font-size:13px; color:#757575;">
      ${TRIAL_DAY13_EMAIL.footnote}
    </p>
  `;
  return wrapEmail(body, unsubscribeUrl);
}

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

export function buildTrialExpiredEmail(
  name: string,
  upgradeUrl: string,
  unsubscribeUrl: string,
): string {
  const body = `
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:#1A237E;">${TRIAL_EXPIRED_EMAIL.heading(name)}</h1>
    <p style="margin:0 0 16px; font-size:16px; color:#424242; line-height:1.6;">
      ${TRIAL_EXPIRED_EMAIL.intro}
    </p>
    <p style="margin:0 0 24px; font-size:16px; color:#424242; line-height:1.6;">
      ${TRIAL_EXPIRED_EMAIL.body}
    </p>
    <a href="${upgradeUrl}"
       style="display:inline-block; background-color:#3949AB; color:#ffffff; padding:14px 28px; border-radius:100px; font-size:15px; font-weight:600; text-decoration:none; letter-spacing:0.2px;">
      ${TRIAL_EXPIRED_EMAIL.cta}
    </a>
  `;
  return wrapEmail(body, unsubscribeUrl);
}

export function buildWelcomeEmail(
  name: string,
  getStartedUrl: string,
  unsubscribeUrl: string,
): string {
  const body = `
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:#1A237E;">${WELCOME_EMAIL.heading(name)}</h1>
    <p style="margin:0 0 16px; font-size:16px; color:#424242; line-height:1.6;">
      ${WELCOME_EMAIL.intro}
    </p>
    <p style="margin:0 0 8px; font-size:15px; font-weight:600; color:#1A237E;">${WELCOME_EMAIL.bulletsHeading}</p>
    <ul style="margin:0 0 24px; padding-left:20px; font-size:15px; color:#424242; line-height:1.8;">
      ${WELCOME_EMAIL.bullets.map((item) => `<li>${item}</li>`).join('\n      ')}
    </ul>
    <a href="${getStartedUrl}"
       style="display:inline-block; background-color:#3949AB; color:#ffffff; padding:14px 28px; border-radius:100px; font-size:15px; font-weight:600; text-decoration:none; letter-spacing:0.2px;">
      ${WELCOME_EMAIL.cta}
    </a>
  `;
  return wrapEmail(body, unsubscribeUrl);
}

export function buildActiveExplorerEmail(
  name: string,
  dashboardUrl: string,
  unsubscribeUrl: string,
): string {
  const body = `
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:#1A237E;">${ACTIVE_EXPLORER_EMAIL.heading(name)}</h1>
    <p style="margin:0 0 16px; font-size:16px; color:#424242; line-height:1.6;">
      ${ACTIVE_EXPLORER_EMAIL.intro}
    </p>
    <p style="margin:0 0 8px; font-size:15px; font-weight:600; color:#1A237E;">${ACTIVE_EXPLORER_EMAIL.bulletsHeading}</p>
    <ul style="margin:0 0 16px; padding-left:20px; font-size:15px; color:#424242; line-height:1.8;">
      ${ACTIVE_EXPLORER_EMAIL.bullets.map((item) => `<li>${item}</li>`).join('\n      ')}
    </ul>
    <p style="margin:0 0 24px; font-size:15px; color:#424242; line-height:1.6;">
      ${SCORE_DESCRIPTION}
    </p>
    <a href="${dashboardUrl}"
       style="display:inline-block; background-color:#3949AB; color:#ffffff; padding:14px 28px; border-radius:100px; font-size:15px; font-weight:600; text-decoration:none; letter-spacing:0.2px;">
      ${ACTIVE_EXPLORER_EMAIL.cta}
    </a>
  `;
  return wrapEmail(body, unsubscribeUrl);
}

export function buildReportGeneratedEmail(
  name: string,
  reportsUrl: string,
  unsubscribeUrl: string,
): string {
  const body = `
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:#1A237E;">${REPORT_GENERATED_EMAIL.heading(name)}</h1>
    <p style="margin:0 0 16px; font-size:16px; color:#424242; line-height:1.6;">
      ${REPORT_GENERATED_EMAIL.intro}
    </p>
    <ul style="margin:0 0 16px; padding-left:20px; font-size:15px; color:#424242; line-height:1.8;">
      ${REPORT_GENERATED_EMAIL.bullets.map((item) => `<li>${item}</li>`).join('\n      ')}
    </ul>
    <p style="margin:0 0 24px; font-size:15px; color:#424242; line-height:1.6;">
      ${REPORT_GENERATED_EMAIL.closing}
    </p>
    <a href="${reportsUrl}"
       style="display:inline-block; background-color:#3949AB; color:#ffffff; padding:14px 28px; border-radius:100px; font-size:15px; font-weight:600; text-decoration:none; letter-spacing:0.2px;">
      ${REPORT_GENERATED_EMAIL.cta}
    </a>
  `;
  return wrapEmail(body, unsubscribeUrl);
}

export function buildPaywallHitEmail(
  name: string,
  featureName: string,
  upgradeUrl: string,
  unsubscribeUrl: string,
): string {
  const body = `
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:#1A237E;">${PAYWALL_HIT_EMAIL.heading(name)}</h1>
    <p style="margin:0 0 16px; font-size:16px; color:#424242; line-height:1.6;">
      ${PAYWALL_HIT_EMAIL.intro(featureName)}
    </p>
    <ul style="margin:0 0 16px; padding-left:20px; font-size:15px; color:#424242; line-height:1.8;">
      ${PAYWALL_HIT_EMAIL.bullets.map((item) => `<li>${item}</li>`).join('\n      ')}
    </ul>
    <p style="margin:0 0 24px; font-size:15px; color:#424242; line-height:1.6;">
      ${PAYWALL_HIT_EMAIL.closing}
    </p>
    <a href="${upgradeUrl}"
       style="display:inline-block; background-color:#3949AB; color:#ffffff; padding:14px 28px; border-radius:100px; font-size:15px; font-weight:600; text-decoration:none; letter-spacing:0.2px;">
      ${PAYWALL_HIT_EMAIL.cta}
    </a>
  `;
  return wrapEmail(body, unsubscribeUrl);
}

export function buildPostTrial7dEmail(
  name: string,
  reportsUrl: string,
  upgradeUrl: string,
  unsubscribeUrl: string,
): string {
  const body = `
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:#1A237E;">${POST_TRIAL_7D_EMAIL.heading(name)}</h1>
    <p style="margin:0 0 16px; font-size:16px; color:#424242; line-height:1.6;">
      ${POST_TRIAL_7D_EMAIL.intro}
    </p>
    <p style="margin:0 0 24px; font-size:16px; color:#424242; line-height:1.6;">
      ${POST_TRIAL_7D_EMAIL.body}
    </p>
    <a href="${reportsUrl}"
       style="display:inline-block; background-color:#3949AB; color:#ffffff; padding:14px 28px; border-radius:100px; font-size:15px; font-weight:600; text-decoration:none; letter-spacing:0.2px;">
      ${POST_TRIAL_7D_EMAIL.cta}
    </a>
    <p style="margin:16px 0 0; font-size:13px; color:#757575;">
      ${POST_TRIAL_7D_EMAIL.upgradePrompt} <a href="${upgradeUrl}" style="color:#3949AB; text-decoration:none;">${POST_TRIAL_7D_EMAIL.upgradeLinkText}</a>
    </p>
  `;
  return wrapEmail(body, unsubscribeUrl);
}

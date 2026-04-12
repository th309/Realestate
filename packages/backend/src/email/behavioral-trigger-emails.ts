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
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:#1A237E;">Hi ${name},</h1>
    <p style="margin:0 0 16px; font-size:16px; color:#424242; line-height:1.6;">
      You signed up for PropertyIQ yesterday — great call. Your market intelligence dashboard is ready with real-time scores for over 20,000 ZIP codes, 3,000 counties, and 750 metros.
    </p>
    <p style="margin:0 0 24px; font-size:16px; color:#424242; line-height:1.6;">
      Takes less than 2 minutes to explore your first market. Pick any city, county, or ZIP and see how it ranks.
    </p>
    <a href="${dashboardUrl}"
       style="display:inline-block; background-color:#3949AB; color:#ffffff; padding:14px 28px; border-radius:100px; font-size:15px; font-weight:600; text-decoration:none; letter-spacing:0.2px;">
      Open My Dashboard
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
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:#1A237E;">Hi ${name},</h1>
    <p style="margin:0 0 16px; font-size:16px; color:#424242; line-height:1.6;">
      Your PropertyIQ Pro trial ends in <strong>4 days</strong>. After that, you'll lose access to:
    </p>
    <ul style="margin:0 0 16px; padding-left:20px; font-size:15px; color:#424242; line-height:1.8;">
      <li>Full market deep-dive reports</li>
      <li>ZIP-level PropertyIQ Scores</li>
      <li>Historical trend data (5 years)</li>
      <li>Unlimited market comparisons</li>
    </ul>
    <p style="margin:0 0 24px; font-size:16px; color:#424242; line-height:1.6;">
      Lock in your access now and keep the edge you've been building.
    </p>
    <a href="${upgradeUrl}"
       style="display:inline-block; background-color:#3949AB; color:#ffffff; padding:14px 28px; border-radius:100px; font-size:15px; font-weight:600; text-decoration:none; letter-spacing:0.2px;">
      Upgrade to Pro
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
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:#1A237E;">Hi ${name},</h1>
    <p style="margin:0 0 16px; font-size:16px; color:#424242; line-height:1.6;">
      Your Pro trial expires <strong>tomorrow</strong>. Don't lose access right when markets are moving.
    </p>
    <p style="margin:0 0 24px; font-size:16px; color:#424242; line-height:1.6;">
      Upgrading takes 30 seconds. Your analysis, your saved markets, your history — all stays right where you left it.
    </p>
    <a href="${upgradeUrl}"
       style="display:inline-block; background-color:#3949AB; color:#ffffff; padding:14px 28px; border-radius:100px; font-size:15px; font-weight:600; text-decoration:none; letter-spacing:0.2px;">
      Keep My Pro Access
    </a>
    <p style="margin:16px 0 0; font-size:13px; color:#757575;">
      Questions? Reply to this email — we're real people.
    </p>
  `;
  return wrapEmail(body, unsubscribeUrl);
}

export function buildTrialExpiredEmail(
  name: string,
  upgradeUrl: string,
  unsubscribeUrl: string,
): string {
  const body = `
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:#1A237E;">Hi ${name},</h1>
    <p style="margin:0 0 16px; font-size:16px; color:#424242; line-height:1.6;">
      Your PropertyIQ Pro trial has ended. Your account is still active on the free plan, but you've lost access to deep-dive reports and ZIP-level scores.
    </p>
    <p style="margin:0 0 24px; font-size:16px; color:#424242; line-height:1.6;">
      Upgrade any time to get everything back instantly — no re-setup required.
    </p>
    <a href="${upgradeUrl}"
       style="display:inline-block; background-color:#3949AB; color:#ffffff; padding:14px 28px; border-radius:100px; font-size:15px; font-weight:600; text-decoration:none; letter-spacing:0.2px;">
      Reactivate Pro
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
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:#1A237E;">Welcome to PropertyIQ, ${name}.</h1>
    <p style="margin:0 0 16px; font-size:16px; color:#424242; line-height:1.6;">
      You now have access to real-time market intelligence for over 20,000 ZIP codes, 3,000 counties, and 750 metros across the US.
    </p>
    <p style="margin:0 0 8px; font-size:15px; font-weight:600; color:#1A237E;">Here's what to do first:</p>
    <ul style="margin:0 0 24px; padding-left:20px; font-size:15px; color:#424242; line-height:1.8;">
      <li>Search any market and check its PropertyIQ Score</li>
      <li>Compare metros side-by-side</li>
      <li>Generate your first market report</li>
    </ul>
    <a href="${getStartedUrl}"
       style="display:inline-block; background-color:#3949AB; color:#ffffff; padding:14px 28px; border-radius:100px; font-size:15px; font-weight:600; text-decoration:none; letter-spacing:0.2px;">
      Get Started
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
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:#1A237E;">You're asking the right questions, ${name}.</h1>
    <p style="margin:0 0 16px; font-size:16px; color:#424242; line-height:1.6;">
      You've already checked several PropertyIQ Scores — here's how experienced investors use them to time their moves.
    </p>
    <p style="margin:0 0 8px; font-size:15px; font-weight:600; color:#1A237E;">The investor playbook:</p>
    <ul style="margin:0 0 16px; padding-left:20px; font-size:15px; color:#424242; line-height:1.8;">
      <li><strong>Score 70+:</strong> Strong demand signal — competition is high, act fast</li>
      <li><strong>Score 50–69:</strong> Balanced market — good for negotiation leverage</li>
      <li><strong>Score &lt;50:</strong> Buyer's market — price concessions are common</li>
    </ul>
    <p style="margin:0 0 24px; font-size:15px; color:#424242; line-height:1.6;">
      Scores are calculated from sold-above-list rate, days on market, and months of supply — updated monthly from Redfin data.
    </p>
    <a href="${dashboardUrl}"
       style="display:inline-block; background-color:#3949AB; color:#ffffff; padding:14px 28px; border-radius:100px; font-size:15px; font-weight:600; text-decoration:none; letter-spacing:0.2px;">
      Keep Exploring Markets
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
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:#1A237E;">Your report is ready, ${name}.</h1>
    <p style="margin:0 0 16px; font-size:16px; color:#424242; line-height:1.6;">
      Here's how to get the most out of your PropertyIQ market report:
    </p>
    <ul style="margin:0 0 16px; padding-left:20px; font-size:15px; color:#424242; line-height:1.8;">
      <li><strong>PropertyIQ Score</strong> — demand signal relative to the state average (50 = average)</li>
      <li><strong>Trend charts</strong> — scroll down to see how key metrics have moved over 3–5 years</li>
      <li><strong>AI narrative</strong> — plain-language summary of what the data means for buyers and investors</li>
      <li><strong>Share link</strong> — send a read-only version to clients or partners</li>
    </ul>
    <p style="margin:0 0 24px; font-size:15px; color:#424242; line-height:1.6;">
      You can access all your reports from the Reports tab any time.
    </p>
    <a href="${reportsUrl}"
       style="display:inline-block; background-color:#3949AB; color:#ffffff; padding:14px 28px; border-radius:100px; font-size:15px; font-weight:600; text-decoration:none; letter-spacing:0.2px;">
      View My Reports
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
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:#1A237E;">You found something good, ${name}.</h1>
    <p style="margin:0 0 16px; font-size:16px; color:#424242; line-height:1.6;">
      You tried to access <strong>${featureName}</strong> — that's a Pro feature. Upgrade now to unlock it along with:
    </p>
    <ul style="margin:0 0 16px; padding-left:20px; font-size:15px; color:#424242; line-height:1.8;">
      <li>Full market deep-dive reports</li>
      <li>ZIP-level PropertyIQ Scores</li>
      <li>Historical trend data (5 years)</li>
      <li>Unlimited market comparisons</li>
    </ul>
    <p style="margin:0 0 24px; font-size:15px; color:#424242; line-height:1.6;">
      Start a free 14-day trial — no credit card required.
    </p>
    <a href="${upgradeUrl}"
       style="display:inline-block; background-color:#3949AB; color:#ffffff; padding:14px 28px; border-radius:100px; font-size:15px; font-weight:600; text-decoration:none; letter-spacing:0.2px;">
      Unlock Pro Features
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
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:#1A237E;">Your free report credit is still waiting, ${name}.</h1>
    <p style="margin:0 0 16px; font-size:16px; color:#424242; line-height:1.6;">
      It's been a week since your Pro trial ended. You still have a free report credit on your account — use it to generate a full market deep-dive at no cost.
    </p>
    <p style="margin:0 0 24px; font-size:16px; color:#424242; line-height:1.6;">
      Pick any market — city, county, or ZIP — and get a complete analysis with PropertyIQ Scores, trend charts, and an AI narrative.
    </p>
    <a href="${reportsUrl}"
       style="display:inline-block; background-color:#3949AB; color:#ffffff; padding:14px 28px; border-radius:100px; font-size:15px; font-weight:600; text-decoration:none; letter-spacing:0.2px;">
      Use My Free Report
    </a>
    <p style="margin:16px 0 0; font-size:13px; color:#757575;">
      Ready to go Pro? <a href="${upgradeUrl}" style="color:#3949AB; text-decoration:none;">See plans</a>
    </p>
  `;
  return wrapEmail(body, unsubscribeUrl);
}

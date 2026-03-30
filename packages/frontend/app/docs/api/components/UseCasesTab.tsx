"use client";

import {
  FileText,
  Code,
  Table,
  Bell,
  BarChart3,
  Mail,
  Globe,
  TrendingUp,
  MessageSquare,
  Plug,
} from "lucide-react";
import { UseCaseCard } from "./UseCaseCard";
import { CodeTabs } from "./CodeTabs";

/* -------------------------------------------------------------------------- */
/* Use Case 1 — Auto-Generate Reports                                          */
/* -------------------------------------------------------------------------- */

const REPORT_POST_CURL = `curl -X POST https://backend-production-ee4d.up.railway.app/api/v1/reports \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "geo_level": "zip",
    "geo_id": "90210",
    "report_type": "market_snapshot"
  }'

# Response: { "report_id": "rpt_abc123", "status": "generating" }`;

const REPORT_POST_JS = `const response = await fetch(
  'https://backend-production-ee4d.up.railway.app/api/v1/reports',
  {
    method: 'POST',
    headers: {
      Authorization: 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      geo_level: 'zip',
      geo_id: '90210',
      report_type: 'market_snapshot',
    }),
  }
);
const { report_id } = await response.json();
// report_id: "rpt_abc123"`;

const REPORT_POST_PYTHON = `import requests

response = requests.post(
    "https://backend-production-ee4d.up.railway.app/api/v1/reports",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    json={
        "geo_level": "zip",
        "geo_id": "90210",
        "report_type": "market_snapshot",
    },
)
report_id = response.json()["report_id"]
# report_id: "rpt_abc123"`;

const REPORT_POLL_CURL = `# Poll until status == "complete" (usually < 10 seconds)
curl https://backend-production-ee4d.up.railway.app/api/v1/reports/rpt_abc123 \\
  -H "Authorization: Bearer YOUR_API_KEY"

# Response when done:
# { "status": "complete", "download_url": "https://..." }`;

const REPORT_POLL_JS = `async function waitForReport(reportId: string, apiKey: string) {
  while (true) {
    const res = await fetch(
      \`https://backend-production-ee4d.up.railway.app/api/v1/reports/\${reportId}\`,
      { headers: { Authorization: \`Bearer \${apiKey}\` } }
    );
    const data = await res.json();
    if (data.status === 'complete') return data.download_url;
    if (data.status === 'failed') throw new Error('Report generation failed');
    await new Promise((r) => setTimeout(r, 2000)); // wait 2s then retry
  }
}`;

const REPORT_POLL_PYTHON = `import time

def wait_for_report(report_id: str, api_key: str) -> str:
    url = f"https://backend-production-ee4d.up.railway.app/api/v1/reports/{report_id}"
    headers = {"Authorization": f"Bearer {api_key}"}
    while True:
        data = requests.get(url, headers=headers).json()
        if data["status"] == "complete":
            return data["download_url"]
        if data["status"] == "failed":
            raise RuntimeError("Report generation failed")
        time.sleep(2)`;

/* -------------------------------------------------------------------------- */
/* Use Case 2 — Embed a Score on Your Website                                 */
/* -------------------------------------------------------------------------- */

const EMBED_FETCH_JS = `// server-side proxy (Next.js API route, Express, etc.)
// NEVER put your API key in client-side JavaScript

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const zip = searchParams.get('zip') ?? '90210';

  const res = await fetch(
    \`https://backend-production-ee4d.up.railway.app/api/v1/scores/zip/\${zip}\`,
    { headers: { Authorization: \`Bearer \${process.env.PROPERTYIQ_API_KEY}\` } }
  );
  const data = await res.json();

  // Return only what the client needs — no secrets exposed
  return Response.json({ score: data.score, label: data.label });
}`;

const EMBED_RENDER_JS = `// Client-side: call your own proxy, not the API directly
const res = await fetch('/api/market-score?zip=90210');
const { score, label } = await res.json();

document.getElementById('score-value').textContent = score;
document.getElementById('score-label').textContent = label;`;

/* -------------------------------------------------------------------------- */
/* Use Case 3 — Pull Data into Google Sheets                                  */
/* -------------------------------------------------------------------------- */

const SHEETS_SCRIPT = `// Google Apps Script — Extensions > Apps Script > paste this > save
function fetchPropertyIQData() {
  const API_KEY = "YOUR_API_KEY";
  const url =
    "https://backend-production-ee4d.up.railway.app/api/v1/metrics/home_value/zip/90210";
  const options = {
    headers: { Authorization: "Bearer " + API_KEY },
  };
  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());

  const sheet = SpreadsheetApp.getActiveSheet();
  sheet.getRange("A1").setValue("Home Value");
  sheet.getRange("B1").setValue(data.data.value);
  sheet.getRange("C1").setValue(data.data.period_date);
  sheet.getRange("D1").setValue(new Date()); // last refreshed
}`;

/* -------------------------------------------------------------------------- */
/* Use Case 4 — Automated Client Alerts                                       */
/* -------------------------------------------------------------------------- */

const ALERTS_JS = `// Node.js — run on a schedule (cron, Railway cron, Vercel cron, etc.)
import cron from 'node-cron';

// Runs every day at 8 AM
cron.schedule('0 8 * * *', async () => {
  const zip = '90210';
  const current = await fetchScore(zip);
  const previous = await db.getLastKnownScore(zip); // your own storage

  if (previous && Math.abs(current.score - previous.score) >= 3) {
    await sendEmail({
      to: 'client@example.com',
      subject: \`Market update: \${zip} score changed to \${current.score}\`,
      body: \`Your market score moved from \${previous.score} → \${current.score} (\${current.label}).\`,
    });
  }

  await db.saveScore(zip, current);
});

async function fetchScore(zip: string) {
  const res = await fetch(
    \`https://backend-production-ee4d.up.railway.app/api/v1/scores/zip/\${zip}\`,
    { headers: { Authorization: \`Bearer \${process.env.PROPERTYIQ_API_KEY}\` } }
  );
  return res.json();
}`;

const ALERTS_ZAPIER = `# No-code alternative: Zapier or Make (Integromat)
#
# 1. Trigger: Schedule (daily)
# 2. Action: HTTP GET
#    URL: https://backend-production-ee4d.up.railway.app/api/v1/scores/zip/90210
#    Header: Authorization: Bearer YOUR_API_KEY
# 3. Filter: only continue if score changed (compare to stored value)
# 4. Action: Send Email via Gmail / Mailchimp / etc.
#
# No server needed — Zapier handles the scheduling and email.`;

/* -------------------------------------------------------------------------- */
/* Use Case 5 — Market Comparison for Listing Presentations                   */
/* -------------------------------------------------------------------------- */

const COMPARE_JS = `const API_KEY = process.env.PROPERTYIQ_API_KEY;
const BASE = 'https://backend-production-ee4d.up.railway.app';

async function fetchMarketSnapshot(zip: string) {
  const [scoreRes, metricsRes] = await Promise.all([
    fetch(\`\${BASE}/api/v1/scores/zip/\${zip}\`, {
      headers: { Authorization: \`Bearer \${API_KEY}\` },
    }),
    fetch(\`\${BASE}/api/v1/metrics/home_value/zip/\${zip}\`, {
      headers: { Authorization: \`Bearer \${API_KEY}\` },
    }),
  ]);
  const score = await scoreRes.json();
  const metrics = await metricsRes.json();
  return { zip, score: score.score, label: score.label, homeValue: metrics.data.value };
}

// Fetch both markets in parallel
const [marketA, marketB] = await Promise.all([
  fetchMarketSnapshot('90210'),
  fetchMarketSnapshot('10001'),
]);

const comparison = {
  markets: [marketA, marketB],
  winner: marketA.score > marketB.score ? marketA.zip : marketB.zip,
  scoreDiff: Math.abs(marketA.score - marketB.score),
};

console.log(comparison);
// { markets: [...], winner: "90210", scoreDiff: 14 }`;

/* -------------------------------------------------------------------------- */
/* Use Case 6 — Monthly Market Newsletter                                      */
/* -------------------------------------------------------------------------- */

const NEWSLETTER_JS = `const API_KEY = process.env.PROPERTYIQ_API_KEY;
const BASE = 'https://backend-production-ee4d.up.railway.app';

// Step 1: Fetch top movers from rankings
const rankingsRes = await fetch(
  \`\${BASE}/api/v1/rankings/propertyiq/zip?limit=5&sort=score_change_desc\`,
  { headers: { Authorization: \`Bearer \${API_KEY}\` } }
);
const { data: topMovers } = await rankingsRes.json();

// Step 2: Pull key metrics for each market
const marketData = await Promise.all(
  topMovers.map(async (market) => {
    const metricsRes = await fetch(
      \`\${BASE}/api/v1/metrics/home_value/zip/\${market.geo_id}\`,
      { headers: { Authorization: \`Bearer \${API_KEY}\` } }
    );
    const metrics = await metricsRes.json();
    return { ...market, homeValue: metrics.data.value };
  })
);

// Step 3: Format into an HTML email snippet
const rows = marketData
  .map(
    (m) => \`<tr>
  <td>\${m.geo_id}</td>
  <td>\${m.score}</td>
  <td>\${m.score_change > 0 ? '+' : ''}\${m.score_change}</td>
  <td>$\${(m.homeValue / 1000).toFixed(0)}K</td>
</tr>\`
  )
  .join('\\n');

const emailHtml = \`<h2>Top Markets This Month</h2>
<table>
  <thead><tr><th>ZIP</th><th>Score</th><th>Change</th><th>Home Value</th></tr></thead>
  <tbody>\${rows}</tbody>
</table>\`;

// Step 4: Send via your email provider (Resend example)
await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${process.env.RESEND_API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: 'you@yourdomain.com',
    to: 'subscriber@example.com',
    subject: 'Your Monthly Market Update',
    html: emailHtml,
  }),
});`;

/* -------------------------------------------------------------------------- */
/* Use Case 7 — Website Market Pages                                           */
/* -------------------------------------------------------------------------- */

const MARKET_PAGES_JS = `const API_KEY = process.env.PROPERTYIQ_API_KEY;
const BASE = 'https://backend-production-ee4d.up.railway.app';

async function buildMarketPageData(zip: string) {
  const [scoreRes, homeValueRes, daysOnMarketRes] = await Promise.all([
    fetch(\`\${BASE}/api/v1/scores/zip/\${zip}\`,
      { headers: { Authorization: \`Bearer \${API_KEY}\` } }),
    fetch(\`\${BASE}/api/v1/metrics/home_value/zip/\${zip}\`,
      { headers: { Authorization: \`Bearer \${API_KEY}\` } }),
    fetch(\`\${BASE}/api/v1/metrics/days_on_market/zip/\${zip}\`,
      { headers: { Authorization: \`Bearer \${API_KEY}\` } }),
  ]);

  const score = await scoreRes.json();
  const homeValue = await homeValueRes.json();
  const dom = await daysOnMarketRes.json();

  return {
    zip,
    score: score.score,
    label: score.label,
    homeValue: homeValue.data.value,
    daysOnMarket: dom.data.value,
    updatedAt: new Date().toISOString(),
  };
}

// Render as an HTML section for your site
function renderMarketSection(data) {
  return \`
<section class="market-snapshot" data-zip="\${data.zip}">
  <h2>Market Overview — \${data.zip}</h2>
  <div class="score-ring">\${data.score} <span>\${data.label}</span></div>
  <ul>
    <li>Median Home Value: $\${(data.homeValue / 1000).toFixed(0)}K</li>
    <li>Avg Days on Market: \${data.daysOnMarket}</li>
    <li>Last updated: \${data.updatedAt}</li>
  </ul>
</section>\`;
}

// Usage: call once per market you serve, cache the output for 24 hours
const data = await buildMarketPageData('90210');
const html = renderMarketSection(data);`;

/* -------------------------------------------------------------------------- */
/* Use Case 8 — Investor Pipeline Scoring                                      */
/* -------------------------------------------------------------------------- */

const PIPELINE_JS = `const API_KEY = process.env.PROPERTYIQ_API_KEY;
const BASE = 'https://backend-production-ee4d.up.railway.app';

// Your investor watchlist
const watchlist = ['90210', '10001', '60601', '77001', '85001'];

// Fetch PropertyIQ rankings and filter to watchlist
const res = await fetch(
  \`\${BASE}/api/v1/rankings/propertyiq/zip\`,
  { headers: { Authorization: \`Bearer \${API_KEY}\` } }
);
const { data: allRankings } = await res.json();

const pipeline = allRankings
  .filter((r) => watchlist.includes(r.geo_id))
  .sort((a, b) => b.score - a.score)
  .map((r, i) => ({
    rank: i + 1,
    zip: r.geo_id,
    score: r.score,
    label: r.label,
    scoreChange: r.score_change,
  }));

console.table(pipeline);
// ┌─────┬───────┬───────┬───────────┬─────────────┐
// │rank │ zip   │ score │ label     │ scoreChange │
// ├─────┼───────┼───────┼───────────┼─────────────┤
// │  1  │ 60601 │  84   │ GREAT     │    +3       │
// │  2  │ 90210 │  76   │ GOOD      │    -1       │
// └─────┴───────┴───────┴───────────┴─────────────┘`;

const PIPELINE_PYTHON = `import requests

API_KEY = "YOUR_API_KEY"
BASE = "https://backend-production-ee4d.up.railway.app"
HEADERS = {"Authorization": f"Bearer {API_KEY}"}

watchlist = {"90210", "10001", "60601", "77001", "85001"}

resp = requests.get(f"{BASE}/api/v1/rankings/propertyiq/zip", headers=HEADERS)
all_rankings = resp.json()["data"]

pipeline = sorted(
    [r for r in all_rankings if r["geo_id"] in watchlist],
    key=lambda r: r["score"],
    reverse=True,
)

for i, r in enumerate(pipeline, 1):
    print(f"{i}. ZIP {r['geo_id']} — score {r['score']} ({r['label']}) "
          f"{'↑' if r['score_change'] > 0 else '↓'}{abs(r['score_change'])}")`;

/* -------------------------------------------------------------------------- */
/* Use Case 9 — Slack/Teams Market Alerts                                     */
/* -------------------------------------------------------------------------- */

const SLACK_JS = `const API_KEY = process.env.PROPERTYIQ_API_KEY;
const BASE = 'https://backend-production-ee4d.up.railway.app';
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL; // from Slack App settings

const markets = ['90210', '10001', '60601'];

const snapshots = await Promise.all(
  markets.map(async (zip) => {
    const res = await fetch(\`\${BASE}/api/v1/scores/zip/\${zip}\`,
      { headers: { Authorization: \`Bearer \${API_KEY}\` } });
    return { zip, ...(await res.json()) };
  })
);

// Build Slack Block Kit message
const blocks = [
  {
    type: 'header',
    text: { type: 'plain_text', text: '📊 Daily Market Summary' },
  },
  ...snapshots.map((m) => ({
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: \`*ZIP \${m.zip}*\` },
      { type: 'mrkdwn', text: \`Score: *\${m.score}* (\${m.label})\` },
    ],
  })),
];

await fetch(SLACK_WEBHOOK, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ blocks }),
});`;

/* -------------------------------------------------------------------------- */
/* Use Case 10 — Connect to Your CRM or Dashboard                             */
/* -------------------------------------------------------------------------- */

const CRM_JS = `import axios from 'axios';

const client = axios.create({
  baseURL: 'https://backend-production-ee4d.up.railway.app/api/v1',
  headers: { Authorization: \`Bearer \${process.env.PROPERTYIQ_API_KEY}\` },
});

// Retry wrapper with exponential backoff
async function fetchWithRetry(url, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await client.get(url);

      // Respect rate limit headers
      const remaining = Number(res.headers['x-ratelimit-remaining'] ?? 100);
      if (remaining < 10) {
        const resetAt = Number(res.headers['x-ratelimit-reset'] ?? 0) * 1000;
        const waitMs = Math.max(0, resetAt - Date.now());
        await new Promise((r) => setTimeout(r, waitMs));
      }

      return res.data;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const isRetryable = err.response?.status === 429 || err.response?.status >= 500;
      if (!isRetryable) throw err;
      // Exponential backoff: 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
}

// Cursor-based pagination — fetch all pages
async function fetchAllPages(endpoint) {
  const results = [];
  let cursor = undefined;
  do {
    const url = cursor ? \`\${endpoint}?cursor=\${cursor}\` : endpoint;
    const page = await fetchWithRetry(url);
    results.push(...page.data);
    cursor = page.next_cursor; // null when no more pages
  } while (cursor);
  return results;
}

// Usage
const allZipScores = await fetchAllPages('/rankings/propertyiq/zip');
console.log(\`Fetched \${allZipScores.length} markets\`);`;

const CRM_PYTHON = `import time
import requests
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

API_KEY = "YOUR_API_KEY"
BASE = "https://backend-production-ee4d.up.railway.app/api/v1"
HEADERS = {"Authorization": f"Bearer {API_KEY}"}

def is_retryable(exc):
    return (
        isinstance(exc, requests.HTTPError)
        and exc.response.status_code in {429, 500, 502, 503, 504}
    )

@retry(
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    retry=retry_if_exception(is_retryable),
)
def fetch_with_retry(url: str) -> dict:
    resp = requests.get(url, headers=HEADERS)
    resp.raise_for_status()

    # Respect rate limit headers
    remaining = int(resp.headers.get("x-ratelimit-remaining", 100))
    if remaining < 10:
        reset_at = int(resp.headers.get("x-ratelimit-reset", 0))
        wait_for = max(0, reset_at - time.time())
        time.sleep(wait_for)

    return resp.json()

def fetch_all_pages(endpoint: str) -> list:
    """Cursor-based pagination — fetches all pages automatically."""
    results = []
    cursor = None
    while True:
        url = f"{BASE}{endpoint}" + (f"?cursor={cursor}" if cursor else "")
        page = fetch_with_retry(url)
        results.extend(page["data"])
        cursor = page.get("next_cursor")
        if not cursor:
            break
    return results

all_zip_scores = fetch_all_pages("/rankings/propertyiq/zip")
print(f"Fetched {len(all_zip_scores)} markets")`;

const COMPARE_PYTHON = `import asyncio
import aiohttp

API_KEY = "YOUR_API_KEY"
BASE = "https://backend-production-ee4d.up.railway.app"
HEADERS = {"Authorization": f"Bearer {API_KEY}"}

async def fetch_market_snapshot(session: aiohttp.ClientSession, zip_code: str) -> dict:
    async with session.get(f"{BASE}/api/v1/scores/zip/{zip_code}", headers=HEADERS) as r:
        score_data = await r.json()
    async with session.get(f"{BASE}/api/v1/metrics/home_value/zip/{zip_code}", headers=HEADERS) as r:
        metrics_data = await r.json()
    return {
        "zip": zip_code,
        "score": score_data["score"],
        "label": score_data["label"],
        "home_value": metrics_data["data"]["value"],
    }

async def compare_markets(zip_a: str, zip_b: str):
    async with aiohttp.ClientSession() as session:
        market_a, market_b = await asyncio.gather(
            fetch_market_snapshot(session, zip_a),
            fetch_market_snapshot(session, zip_b),
        )
    winner = zip_a if market_a["score"] > market_b["score"] else zip_b
    return {"markets": [market_a, market_b], "winner": winner}

result = asyncio.run(compare_markets("90210", "10001"))
print(result)`;

/* -------------------------------------------------------------------------- */
/* Tab component                                                                */
/* -------------------------------------------------------------------------- */

export function UseCasesTab() {
  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-on-surface tracking-tight mb-2">
          Use Cases & Walkthroughs
        </h2>
        <p className="text-sm text-on-surface-variant">
          Real-world examples with copy-paste code. Click any card to expand the
          full walkthrough.
        </p>
      </div>

      {/* Use Case 1 */}
      <UseCaseCard
        title="Auto-Generate Reports"
        description="Create client-ready market reports on demand and deliver them automatically."
        difficulty="Beginner"
        setupTime="5 min"
        icon={<FileText className="w-5 h-5" />}
      >
        <p>
          Trigger report generation with a POST, then poll until the PDF is
          ready. Great for CRM automations — when a new lead comes in,
          auto-generate a report for their market.
        </p>

        <h4 className="text-sm font-medium text-on-surface">
          Step 1 — Trigger report generation
        </h4>
        <CodeTabs
          examples={[
            { language: "bash", label: "curl", code: REPORT_POST_CURL },
            {
              language: "javascript",
              label: "JavaScript",
              code: REPORT_POST_JS,
            },
            { language: "python", label: "Python", code: REPORT_POST_PYTHON },
          ]}
        />

        <h4 className="text-sm font-medium text-on-surface">
          Step 2 — Poll for completion
        </h4>
        <CodeTabs
          examples={[
            { language: "bash", label: "curl", code: REPORT_POLL_CURL },
            {
              language: "javascript",
              label: "JavaScript",
              code: REPORT_POLL_JS,
            },
            { language: "python", label: "Python", code: REPORT_POLL_PYTHON },
          ]}
        />

        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
          💡 You can trigger this from a CRM automation — when a new lead comes
          in, auto-generate a report for their market and attach it to the
          contact record.
        </div>
      </UseCaseCard>

      {/* Use Case 2 */}
      <UseCaseCard
        title="Embed a Score on Your Website"
        description="Show a live PropertyIQ score on Wix, Squarespace, WordPress, or any custom site."
        difficulty="Beginner"
        setupTime="10 min"
        icon={<Code className="w-5 h-5" />}
      >
        <p>
          Two approaches depending on your setup. Pick the one that fits your
          platform.
        </p>

        <h4 className="text-sm font-medium text-on-surface">
          Approach A — Embed widget (no API key required)
        </h4>
        <p>
          The simplest option. PropertyIQ provides pre-built embed widgets you
          can drop into any page. No API key, no code — just copy the embed
          snippet from your{" "}
          <span className="font-medium text-primary">Admin → API Keys</span>{" "}
          panel and paste it into your site&apos;s HTML block.
        </p>
        <p className="text-xs text-on-surface-variant">
          Works with: Wix (Custom Embed), Squarespace (Code Block), WordPress
          (Custom HTML widget), Webflow (Embed element).
        </p>

        <h4 className="text-sm font-medium text-on-surface">
          Approach B — API with server-side proxy
        </h4>
        <p>
          More flexible — lets you control styling completely. You fetch data
          from your own server endpoint (which holds the API key), then render
          however you want on the client.
        </p>

        <div className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 p-3 text-sm text-red-800 dark:text-red-300">
          🔒 <strong>Security:</strong> Never put your API key in client-side
          JavaScript. If using the API approach, always route requests through a
          server-side function (Next.js API route, Edge Function, etc.).
        </div>

        <h4 className="text-sm font-medium text-on-surface">
          Server-side proxy (keeps your API key secret)
        </h4>
        <CodeTabs
          examples={[
            {
              language: "javascript",
              label: "JavaScript",
              code: EMBED_FETCH_JS,
            },
          ]}
        />

        <h4 className="text-sm font-medium text-on-surface">
          Client-side render
        </h4>
        <CodeTabs
          examples={[
            {
              language: "javascript",
              label: "JavaScript",
              code: EMBED_RENDER_JS,
            },
          ]}
        />
      </UseCaseCard>

      {/* Use Case 3 */}
      <UseCaseCard
        title="Pull Data into Google Sheets"
        description="Get market metrics into a spreadsheet that refreshes automatically on a schedule."
        difficulty="Beginner"
        setupTime="10 min"
        icon={<Table className="w-5 h-5" />}
      >
        <p>
          Google Apps Script lets you call any HTTP API directly from Sheets —
          no extensions or third-party tools needed.
        </p>

        <h4 className="text-sm font-medium text-on-surface">Steps</h4>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Open your Google Sheet</li>
          <li>
            Click <strong>Extensions → Apps Script</strong>
          </li>
          <li>
            Paste the script below, replace{" "}
            <code className="text-xs bg-surface-container px-1 py-0.5 rounded">
              YOUR_API_KEY
            </code>
            , and save
          </li>
          <li>Run it once manually to grant permissions</li>
          <li>
            Set a trigger:{" "}
            <strong>Triggers → Add trigger → Time-driven → Daily</strong>
          </li>
        </ol>

        <CodeTabs
          examples={[
            {
              language: "javascript",
              label: "Apps Script",
              code: SHEETS_SCRIPT,
            },
          ]}
        />

        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
          💡 Works similarly with <strong>Excel + Power Automate</strong> — use
          the HTTP action to call the same endpoint and write the response into
          a table.
        </div>
      </UseCaseCard>

      {/* Use Case 4 */}
      <UseCaseCard
        title="Automated Client Alerts"
        description="Email clients automatically when their market score changes — no manual checking."
        difficulty="Intermediate"
        setupTime="15 min"
        icon={<Bell className="w-5 h-5" />}
      >
        <p>
          Set up a daily score check. Compare the current score to the last
          known value. If it changed by more than a threshold (e.g., 3 points),
          send an email.
        </p>

        <h4 className="text-sm font-medium text-on-surface">
          Approach A — Node.js with a cron job
        </h4>
        <p className="text-xs text-on-surface-variant">
          Deploy on Railway, Render, or any always-on Node server.
        </p>
        <CodeTabs
          examples={[
            { language: "javascript", label: "JavaScript", code: ALERTS_JS },
          ]}
        />

        <h4 className="text-sm font-medium text-on-surface">
          Approach B — No-code with Zapier or Make
        </h4>
        <CodeTabs
          examples={[
            { language: "bash", label: "Zapier steps", code: ALERTS_ZAPIER },
          ]}
        />

        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
          💡 Your clients get &quot;Your market just improved to 82&quot;
          without having to ask. A simple retention tool that takes 15 minutes
          to set up.
        </div>
      </UseCaseCard>

      {/* Use Case 5 */}
      <UseCaseCard
        title="Market Comparison for Listing Presentations"
        description="Pull side-by-side data for two markets and build a live comparison — no screenshots."
        difficulty="Intermediate"
        setupTime="10 min"
        icon={<BarChart3 className="w-5 h-5" />}
      >
        <p>
          Agents typically build market comparisons manually using screenshots.
          The API makes it live data — always current, always accurate.
        </p>
        <p>
          Fetch scores and metrics for two ZIP codes in parallel, then build a
          comparison object you can render in a presentation tool, PDF, or web
          page.
        </p>

        <CodeTabs
          examples={[
            { language: "javascript", label: "JavaScript", code: COMPARE_JS },
            { language: "python", label: "Python", code: COMPARE_PYTHON },
          ]}
        />

        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
          💡 Extend this by fetching multiple metrics (days on market,
          list-to-sale ratio, rent yield) for a richer side-by-side comparison
          table.
        </div>
      </UseCaseCard>

      {/* Use Case 6 */}
      <UseCaseCard
        title="Monthly Market Newsletter"
        description="Auto-generate a monthly market update email for your sphere — no manual data gathering."
        difficulty="Intermediate"
        setupTime="20 min"
        icon={<Mail className="w-5 h-5" />}
      >
        <p>
          Fetch the top-moving markets from the rankings endpoint, pull key
          metrics for each, format them into an HTML table, and send via your
          email provider. Schedule this to run on the first of each month.
        </p>

        <h4 className="text-sm font-medium text-on-surface">Steps</h4>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Fetch top movers from the rankings endpoint</li>
          <li>Pull home value metrics for each market in parallel</li>
          <li>Format into an HTML email table</li>
          <li>Send via Mailchimp, Resend, or SendGrid API</li>
        </ol>

        <CodeTabs
          examples={[
            {
              language: "javascript",
              label: "JavaScript",
              code: NEWSLETTER_JS,
            },
          ]}
        />

        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
          💡 Creating newsletter content is the bottleneck — this automates the
          data portion. Pair with a template in your email provider and you have
          a fully automated monthly touch point.
        </div>
      </UseCaseCard>

      {/* Use Case 7 */}
      <UseCaseCard
        title="Website Market Pages"
        description="Create dynamic market pages on your site that update automatically — no stale screenshots."
        difficulty="Advanced"
        setupTime="30 min"
        icon={<Globe className="w-5 h-5" />}
      >
        <p>
          For each market you serve, fetch scores and key metrics, then render a
          page section. Cache the output for 24 hours so each visitor gets fast
          load times while data stays fresh.
        </p>

        <CodeTabs
          examples={[
            {
              language: "javascript",
              label: "JavaScript",
              code: MARKET_PAGES_JS,
            },
          ]}
        />

        <p className="text-xs text-on-surface-variant">
          Works with: any site builder that supports custom code or a headless
          CMS — Next.js, Webflow, WordPress with custom templates, etc.
        </p>

        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
          💡 SEO-friendly, always-fresh content — your market page always shows
          current data. Google indexes these pages and ranks them for
          &quot;[city] housing market&quot; searches.
        </div>
      </UseCaseCard>

      {/* Use Case 8 */}
      <UseCaseCard
        title="Investor Pipeline Scoring"
        description="Score every market in your pipeline and rank them — one API call replaces hours of research."
        difficulty="Intermediate"
        setupTime="15 min"
        icon={<TrendingUp className="w-5 h-5" />}
      >
        <p>
          Fetch the InvestorEdge rankings endpoint, filter to your watchlist
          ZIPs, and sort by score. The result is a ranked table you can paste
          into a report or feed into your CRM.
        </p>

        <CodeTabs
          examples={[
            {
              language: "javascript",
              label: "JavaScript",
              code: PIPELINE_JS,
            },
            { language: "python", label: "Python", code: PIPELINE_PYTHON },
          ]}
        />

        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
          💡 Investor-focused brokerages managing portfolios across many markets
          use this to automate the analysis — what used to take hours of manual
          research runs in seconds.
        </div>
      </UseCaseCard>

      {/* Use Case 9 */}
      <UseCaseCard
        title="Slack / Teams Market Alerts"
        description="Get a daily market summary posted to your team's Slack channel automatically."
        difficulty="Intermediate"
        setupTime="15 min"
        icon={<MessageSquare className="w-5 h-5" />}
      >
        <p>
          Fetch scores for your tracked markets, format a Slack Block Kit
          message, and POST to an incoming webhook URL. Schedule it daily so the
          whole team starts the morning with fresh market data.
        </p>

        <h4 className="text-sm font-medium text-on-surface">Steps</h4>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>
            Create a Slack app at{" "}
            <span className="font-medium">api.slack.com/apps</span> and add an
            Incoming Webhook
          </li>
          <li>Copy the webhook URL into your environment variables</li>
          <li>Deploy the script on Railway or any cron host</li>
          <li>Schedule it daily (e.g., 8 AM)</li>
        </ol>

        <CodeTabs
          examples={[
            { language: "javascript", label: "JavaScript", code: SLACK_JS },
          ]}
        />

        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
          💡 Keeps the whole team informed without anyone having to open the
          dashboard. Works the same way with Microsoft Teams — replace the Slack
          webhook with a Teams incoming webhook URL.
        </div>
      </UseCaseCard>

      {/* Use Case 10 */}
      <UseCaseCard
        title="Connect to Your CRM or Dashboard"
        description="Feed PropertyIQ data into your internal tools with production-grade reliability."
        difficulty="Advanced"
        setupTime="30 min"
        icon={<Plug className="w-5 h-5" />}
      >
        <p>
          This is the developer-focused integration pattern. Covers auth,
          pagination, retry logic, and rate limit handling — everything you need
          for a reliable production integration.
        </p>

        <h4 className="text-sm font-medium text-on-surface">
          Key patterns covered
        </h4>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>
            <strong>Auth:</strong> Pass{" "}
            <code className="text-xs bg-surface-container px-1 py-0.5 rounded">
              Authorization: Bearer YOUR_API_KEY
            </code>{" "}
            on every request
          </li>
          <li>
            <strong>Pagination:</strong> Cursor-based —{" "}
            <code className="text-xs bg-surface-container px-1 py-0.5 rounded">
              next_cursor
            </code>{" "}
            is null on the last page
          </li>
          <li>
            <strong>Retry logic:</strong> Exponential backoff on 429 and 5xx
            responses
          </li>
          <li>
            <strong>Rate limits:</strong> Read{" "}
            <code className="text-xs bg-surface-container px-1 py-0.5 rounded">
              x-ratelimit-remaining
            </code>{" "}
            — back off when below 10
          </li>
          <li>
            <strong>Caching:</strong> Cache scores for 1 hour, metric snapshots
            for 24 hours
          </li>
        </ul>

        <CodeTabs
          examples={[
            {
              language: "javascript",
              label: "JavaScript (axios)",
              code: CRM_JS,
            },
            {
              language: "python",
              label: "Python (tenacity)",
              code: CRM_PYTHON,
            },
          ]}
        />

        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
          💡 The Python example uses{" "}
          <code className="text-xs bg-amber-100 dark:bg-amber-900/30 px-1 py-0.5 rounded">
            tenacity
          </code>{" "}
          for declarative retry logic —{" "}
          <code className="text-xs bg-amber-100 dark:bg-amber-900/30 px-1 py-0.5 rounded">
            pip install tenacity
          </code>
          .
        </div>
      </UseCaseCard>
    </div>
  );
}

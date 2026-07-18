#!/usr/bin/env node
// Pulls PropertyIQ's Google Search Console data via service-account JWT auth.
// Reuses the analytics-mcp SA key (GCP SA keys aren't scope-locked — the scope is
// chosen per token request), so this needs no new credentials, only:
//   1. Search Console API enabled on the SA's GCP project (done)
//   2. The SA email added as a User under Search Console > Settings > Users and permissions
//      for sc-domain:propertyiq.app (manual step, no API exists for this)
//
// Usage:
//   node scripts/analytics/search-console.js sites
//   node scripts/analytics/search-console.js sitemaps
//   node scripts/analytics/search-console.js sitemap <feedpath>
//   node scripts/analytics/search-console.js inspect <url>
//   node scripts/analytics/search-console.js query --start=YYYY-MM-DD --end=YYYY-MM-DD
//     [--dimensions=query,page,country,device,searchAppearance,date] [--rowLimit=25] [--startRow=0]
//     [--searchType=web|image|video|news|discover|googleNews] [--dataState=final|all]
//     [--filter=dimension:operator:expression]  (operator: equals|notEquals|contains|notContains|includingRegex|excludingRegex)
//
// Examples:
//   node scripts/analytics/search-console.js sites
//   node scripts/analytics/search-console.js sitemaps
//   node scripts/analytics/search-console.js sitemap https://www.propertyiq.app/sitemaps/zips-1
//   node scripts/analytics/search-console.js inspect https://www.propertyiq.app/market/12345
//   node scripts/analytics/search-console.js query --start=2026-06-18 --end=2026-07-18 --dimensions=query,page --rowLimit=50
//   node scripts/analytics/search-console.js query --start=2026-04-18 --end=2026-07-18 --dimensions=page --rowLimit=25000 --filter=page:contains:/market/zip/

const fs = require("fs");
const crypto = require("crypto");

const SITE_URL = "sc-domain:propertyiq.app";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

function base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Parses `--key=value` args into an object; bare `--flag` becomes `flag: true`.
function parseFlags(args) {
  const flags = {};
  for (const arg of args) {
    const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (match) flags[match[1]] = match[2] ?? true;
  }
  return flags;
}

async function getAccessToken() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS is not set. Point it at the analytics-mcp service-account key " +
        "(see reference_ga4-mcp-access-norton-bypass memory for the current path).",
    );
  }
  const key = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(`${header}.${claims}`)
    .sign(key.private_key);
  const jwt = `${header}.${claims}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(
      `Token exchange failed: ${res.status} ${JSON.stringify(body)}`,
    );
  }
  return body.access_token;
}

async function callApi(token, url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`${url} failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body;
}

function webmastersUrl(path) {
  return `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}${path}`;
}

async function listSites(token) {
  return callApi(token, "https://www.googleapis.com/webmasters/v3/sites");
}

async function querySearchAnalytics(token, flags) {
  if (!flags.start || !flags.end) {
    throw new Error("query requires --start=YYYY-MM-DD --end=YYYY-MM-DD");
  }
  const requestBody = {
    startDate: flags.start,
    endDate: flags.end,
    dimensions: (flags.dimensions || "query").split(","),
    rowLimit: Number(flags.rowLimit || 25),
    startRow: Number(flags.startRow || 0),
    type: flags.searchType || "web",
    dataState: flags.dataState || "final",
  };
  if (flags.filter) {
    const [dimension, operator, ...rest] = flags.filter.split(":");
    requestBody.dimensionFilterGroups = [
      { filters: [{ dimension, operator, expression: rest.join(":") }] },
    ];
  }
  return callApi(token, webmastersUrl("/searchAnalytics/query"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
}

async function listSitemaps(token) {
  return callApi(token, webmastersUrl("/sitemaps"));
}

async function getSitemap(token, feedpath) {
  return callApi(
    token,
    webmastersUrl(`/sitemaps/${encodeURIComponent(feedpath)}`),
  );
}

async function inspectUrl(token, inspectionUrl) {
  return callApi(
    token,
    "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inspectionUrl, siteUrl: SITE_URL }),
    },
  );
}

async function main() {
  const [, , command, ...args] = process.argv;
  const token = await getAccessToken();
  const print = (data) => console.log(JSON.stringify(data, null, 2));

  if (command === "sites") return print(await listSites(token));
  if (command === "sitemaps") return print(await listSitemaps(token));

  if (command === "sitemap") {
    const [feedpath] = args;
    if (!feedpath)
      throw new Error("Usage: node search-console.js sitemap <feedpath>");
    return print(await getSitemap(token, feedpath));
  }

  if (command === "inspect") {
    const [inspectionUrl] = args;
    if (!inspectionUrl)
      throw new Error("Usage: node search-console.js inspect <url>");
    return print(await inspectUrl(token, inspectionUrl));
  }

  if (command === "query") {
    return print(await querySearchAnalytics(token, parseFlags(args)));
  }

  throw new Error(
    "Usage: node search-console.js <sites|sitemaps|sitemap|inspect|query> ...",
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

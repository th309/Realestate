/**
 * Probe the live backend's /api/analyzer/property-lookup endpoint as an admin
 * user, replicating what the browser does. Mints a session token via the
 * Supabase admin API so we don't need to extract the user's cookie.
 *
 * Compare the response against scripts/validate-rentcast-fix.mjs (which calls
 * RentCast directly): any difference means the backend is doing something
 * different from a raw API call.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

function readEnv(file, key) {
  const text = fs.readFileSync(file, "utf8");
  const line = text.split("\n").find((l) => l.startsWith(`${key}=`));
  return line?.slice(`${key}=`.length).trim().replace(/^"|"$/g, "");
}

const backendEnv = path.join(repoRoot, "packages/backend/.env");
const SUPABASE_URL = readEnv(backendEnv, "SUPABASE_URL");
const SERVICE_KEY = readEnv(backendEnv, "SUPABASE_SERVICE_KEY");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("FAIL: SUPABASE_URL or SUPABASE_SERVICE_KEY missing");
  process.exit(1);
}

const ADMIN_EMAIL = process.env.PROBE_ADMIN_EMAIL || "troyhouston76@gmail.com";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Find the admin user
const { data: usersRes, error: listErr } =
  await admin.auth.admin.listUsers({ perPage: 200 });
if (listErr) {
  console.error("FAIL listUsers:", listErr.message);
  process.exit(1);
}
const adminUser = usersRes.users.find((u) => u.email === ADMIN_EMAIL);
if (!adminUser) {
  console.error(`FAIL: user "${ADMIN_EMAIL}" not found`);
  process.exit(1);
}
console.log(`✓ admin user: ${adminUser.email} (${adminUser.id})`);

// Mint a magic-link session for that user, which gives us an access_token
// without needing the password. We never visit the link; we just decode the
// embedded token from the response.
const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: ADMIN_EMAIL,
});
if (linkErr) {
  console.error("FAIL generateLink:", linkErr.message);
  process.exit(1);
}
// generateLink returns hashed_token + action_link, not a session JWT directly.
// We need to redeem the OTP server-side to get a session.
const { data: verify, error: verifyErr } =
  await admin.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
if (verifyErr || !verify.session) {
  console.error("FAIL verifyOtp:", verifyErr?.message ?? "no session");
  process.exit(1);
}
const jwt = verify.session.access_token;
console.log(`✓ minted JWT (${jwt.length} chars)`);

const ADDRESS = process.argv[2] || "123 S Market St, Frederick, MD 21701";
console.log(`Address: "${ADDRESS}"`);
console.log("");

const url = `http://localhost:3001/api/analyzer/property-lookup?address=${encodeURIComponent(ADDRESS)}`;
const t0 = Date.now();
const res = await fetch(url, {
  headers: { Authorization: `Bearer ${jwt}` },
});
const ms = Date.now() - t0;

console.log(`HTTP ${res.status} in ${ms}ms`);
const text = await res.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  body = text;
}

if (typeof body === "object" && body !== null) {
  // Print the most interesting fields prominently
  console.log(
    JSON.stringify(
      {
        resolved_address: body.resolved_address,
        avm: body.avm,
        rent: body.rent,
        sales_comps_count: Array.isArray(body.sales_comps)
          ? body.sales_comps.length
          : null,
        rental_comps_count: Array.isArray(body.rental_comps)
          ? body.rental_comps.length
          : null,
        errors: body.errors,
        source: body.source,
      },
      null,
      2,
    ),
  );
} else {
  console.log(body);
}

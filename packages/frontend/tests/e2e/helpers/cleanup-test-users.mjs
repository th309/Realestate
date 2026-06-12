// Purge leftover signup-chain E2E users (email starts with "piq-e2e-").
// Run: node -r dotenv/config tests/e2e/helpers/cleanup-test-users.mjs dotenv_config_path=.env.local
// (Reads NEXT_PUBLIC_SUPABASE_URL + a service/secret key from .env.local.)
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or a service/secret key.");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
if (error) {
  console.error("listUsers failed:", error.message);
  process.exit(1);
}

const stale = data.users.filter((u) => u.email?.startsWith("piq-e2e-"));
for (const u of stale) {
  await sb.auth.admin.deleteUser(u.id);
  console.log("deleted", u.email);
}
console.log(`done — ${stale.length} test user(s) removed`);

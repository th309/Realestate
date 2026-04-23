#!/usr/bin/env node
/**
 * Smoke test: upload the Remotion-rendered out.mp4 to YouTube as a private
 * video, matching what YouTubeShortsPublisher.publish() does in production.
 *
 * Reads OAuth creds from packages/backend/.env.local. Prints only the
 * resulting video id + URL; never echoes tokens.
 *
 * Usage:
 *   node scripts/smoke-youtube-upload.mjs [path/to/video.mp4]
 */
import { google } from "googleapis";
import { createReadStream, existsSync, statSync } from "node:fs";
import { readFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// Minimal .env parser — avoids pulling in dotenv just for a smoke test.
function loadEnv(envPath) {
  const text = readFileSync(envPath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    // .env.local is authoritative for local smoke tests — overwrite anything
    // shadowed by the shell (PowerShell profile, Railway CLI, etc.).
    process.env[key] = value;
  }
}

// Repo-root .env.local is the operator's scratchpad for fresh creds.
// Fall back to packages/backend/.env (runtime source) then .env.local there.
for (const p of [".env.local", "packages/backend/.env", "packages/backend/.env.local"]) {
  const full = join(repoRoot, p);
  try {
    loadEnv(full);
    break;
  } catch {
    // try next
  }
}

const videoPath = resolve(process.argv[2] || join(repoRoot, "packages/video-template/out.mp4"));
if (!existsSync(videoPath)) {
  console.error(`video not found: ${videoPath}`);
  process.exit(1);
}
const bytes = statSync(videoPath).size;
console.log(`video=${videoPath}`);
console.log(`size_mb=${(bytes / 1024 / 1024).toFixed(2)}`);

const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
const refreshToken = process.env.YOUTUBE_OAUTH_REFRESH_TOKEN;
if (!clientId || !clientSecret || !refreshToken) {
  console.error("missing YOUTUBE_OAUTH_* env vars in packages/backend/.env.local");
  process.exit(1);
}

const auth = new google.auth.OAuth2(clientId, clientSecret);
auth.setCredentials({ refresh_token: refreshToken });

const yt = google.youtube({ version: "v3", auth });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const title = `[SMOKE TEST] Cleveland Grade Reveal — ${stamp}`;
const description = [
  "Automated P1 acceptance smoke test for PropertyIQ Content Pipeline.",
  "Source: packages/video-template/out.mp4 (Remotion grade_reveal composition).",
  "Safe to delete.",
  "",
  "#Shorts",
].join("\n");

console.log(`title=${title}`);
console.log("upload_start=" + new Date().toISOString());
const t0 = Date.now();

try {
  const response = await yt.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title,
        description,
        tags: ["smoke-test", "propertyiq", "p1"],
        categoryId: "22",
      },
      status: {
        privacyStatus: "private",
        selfDeclaredMadeForKids: false,
      },
    },
    media: { body: createReadStream(videoPath) },
  });

  const elapsedMs = Date.now() - t0;
  const videoId = response.data.id;
  console.log("upload_end=" + new Date().toISOString());
  console.log(`upload_elapsed_ms=${elapsedMs}`);
  console.log(`upload_elapsed_s=${(elapsedMs / 1000).toFixed(1)}`);
  console.log(`video_id=${videoId}`);
  console.log(`video_url=https://youtube.com/shorts/${videoId}`);
  console.log(`studio_url=https://studio.youtube.com/video/${videoId}/edit`);
  console.log(`privacy=${response.data.status?.privacyStatus}`);
  console.log(`upload_status=${response.data.status?.uploadStatus}`);
  console.log("result=OK");
} catch (err) {
  const elapsedMs = Date.now() - t0;
  console.log(`upload_elapsed_ms=${elapsedMs}`);
  const e = err;
  console.log("result=ERROR");
  console.log("error_message=" + (e.message || "unknown"));
  if (e.errors) console.log("errors=" + JSON.stringify(e.errors));
  process.exit(2);
}

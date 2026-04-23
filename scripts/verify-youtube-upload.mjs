#!/usr/bin/env node
/**
 * Diagnostic: given a videoId, verify the upload landed on the expected
 * channel and report status fields so we can tell if the user is looking
 * at the wrong channel in Studio.
 *
 * Usage: node scripts/verify-youtube-upload.mjs <videoId>
 */
import { google } from "googleapis";
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

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

const videoId = process.argv[2];
// videoId is optional — omit it to run a channel-identity check only.

const auth = new google.auth.OAuth2(
  process.env.YOUTUBE_OAUTH_CLIENT_ID,
  process.env.YOUTUBE_OAUTH_CLIENT_SECRET,
);
auth.setCredentials({ refresh_token: process.env.YOUTUBE_OAUTH_REFRESH_TOKEN });

const yt = google.youtube({ version: "v3", auth });

// 1. Which channel is the token authorized for?
const chRes = await yt.channels.list({ part: ["snippet", "contentDetails"], mine: true });
const ch = chRes.data.items?.[0];
console.log("=== authorized channel ===");
console.log("channel_id=" + ch?.id);
console.log("channel_title=" + ch?.snippet?.title);
console.log("custom_url=" + (ch?.snippet?.customUrl || "(none)"));

if (!videoId) {
  console.log("=== skipping video lookup (no videoId arg) ===");
  process.exit(0);
}

// 2. Fetch the uploaded video by id
const vRes = await yt.videos.list({ part: ["snippet", "status", "processingDetails"], id: [videoId] });
const v = vRes.data.items?.[0];
console.log("=== video by id ===");
if (!v) {
  console.log("video_found=NO");
  console.log("(the token-authorized account cannot see this video id — it may have been deleted, or it is on a different channel than the token's)");
  process.exit(0);
}
console.log("video_found=YES");
console.log("video_id=" + v.id);
console.log("title=" + v.snippet?.title);
console.log("channel_id=" + v.snippet?.channelId);
console.log("channel_title=" + v.snippet?.channelTitle);
console.log("published_at=" + v.snippet?.publishedAt);
console.log("privacy_status=" + v.status?.privacyStatus);
console.log("upload_status=" + v.status?.uploadStatus);
console.log("processing_status=" + v.processingDetails?.processingStatus);
console.log("made_for_kids=" + v.status?.madeForKids);
console.log("self_declared_made_for_kids=" + v.status?.selfDeclaredMadeForKids);

// 3. Check: is the video on the same channel as the authorized one?
console.log("=== match check ===");
const onAuthorizedChannel = v.snippet?.channelId === ch?.id;
console.log("video_on_authorized_channel=" + (onAuthorizedChannel ? "YES" : "NO"));

// 4. Pull the uploads playlist and check recent items
const uploadsId = ch?.contentDetails?.relatedPlaylists?.uploads;
if (uploadsId) {
  const plRes = await yt.playlistItems.list({
    part: ["snippet"],
    playlistId: uploadsId,
    maxResults: 5,
  });
  console.log("=== recent uploads on authorized channel ===");
  for (const item of plRes.data.items || []) {
    const vid = item.snippet?.resourceId?.videoId;
    console.log(`- ${vid}  ${item.snippet?.title}  (${item.snippet?.publishedAt})`);
  }
} else {
  console.log("uploads_playlist=none");
}

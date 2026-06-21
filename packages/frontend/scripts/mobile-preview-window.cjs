/**
 * Phone-sized mobile preview window.
 *
 * Opens a VISIBLE Chromium window emulating a phone (iPhone viewport + touch)
 * pointed at the :3100 mobile-web preview, so you can see the responsive site's
 * mobile view on demand. Uses a PERSISTENT profile so a login sticks across
 * relaunches. Stays open until the window is closed or the task is stopped.
 *
 * Run it from packages/frontend (so `playwright` resolves) with the
 * Bash tool's run_in_background: true, e.g.:
 *   cd packages/frontend && MSYS_NO_PATHCONV=1 node scripts/mobile-preview-window.cjs
 * Env:
 *   BASE_URL    default http://localhost:3100  (the mobile-web preview)
 *   START_PATH  default /                       (e.g. /map, /analyzer)
 *   PROFILE_DIR default <tmp>/piq-mobile-preview (persisted login)
 *
 * Gotchas baked in / to remember:
 *  - The keep-alive below is a REF'd setInterval, NOT `await new Promise(()=>{})`.
 *    A bare unsettled promise does not ref Node's event loop, so Node exits
 *    immediately and the harness reaps the child Chromium (exit 127).
 *  - Pass MSYS_NO_PATHCONV=1 in Git Bash, and don't pass START_PATH="/" on the
 *    CLI — Git Bash rewrites a leading-slash arg into a Windows path.
 *  - :3100 must already be up (npm run dev:mobile-web / dev:fresh). First /map
 *    load cold-compiles (~30-60s); the window shows a blank page until then.
 *  - If it errors "Browser is already in use" the profile is locked by a stale
 *    window — kill chrome.exe whose command line contains "piq-mobile-preview"
 *    first (see the skill's teardown), then relaunch.
 */
let pw;
try {
  pw = require("playwright");
} catch {
  pw = require("@playwright/test");
}
const os = require("os");
const { chromium, devices } = pw;

const BASE = process.env.BASE_URL || "http://localhost:3100";
const START_PATH = process.env.START_PATH || "/";
const PROFILE_DIR =
  process.env.PROFILE_DIR || os.tmpdir() + "/piq-mobile-preview";
const device =
  devices["iPhone 14 Pro"] ||
  devices["iPhone 13"] || {
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  };

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    ...device,
    args: ["--window-size=440,940", "--window-position=60,40"],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  try {
    await page.goto(BASE + START_PATH, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
  } catch (e) {
    console.log("nav warning:", e.message);
  }
  const size = device.viewport
    ? `${device.viewport.width}x${device.viewport.height}`
    : "mobile";
  console.log(
    `Mobile preview window open at ${BASE}${START_PATH} (${size}). ` +
      "Log in inside this window for authed views. Close the window or stop this task to exit.",
  );
  // Keep the Node process (and thus the window) alive until the window closes.
  const keepAlive = setInterval(() => {}, 1 << 30);
  ctx.on("close", () => {
    clearInterval(keepAlive);
    process.exit(0);
  });
})();

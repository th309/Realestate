# Lessons Learned

## Build Verification Must Fix ALL Errors Before Pushing

**Date:** 2026-02-26
**Context:** Ran `nest build` to verify a billing fix, saw 7 pre-existing errors in other files, dismissed them as "not my problem," and pushed. The deploy failed because those same errors broke the production build.

**Rule:** When verifying a build, if it fails, fix EVERY error before pushing — not just the ones from your change. A broken build is a broken build. "Pre-existing" doesn't matter; if it fails locally, it fails in CI/production. Never push code that doesn't build clean.

**Wrong behavior:**

- Run build, see errors in unrelated files
- Say "those are pre-existing, not from my change"
- Push anyway

**Correct behavior:**

- Run build, see ANY errors
- Fix all of them
- Verify build passes with zero errors
- Then push

## Never Hardcode Fallback Values for Config/Secrets

**Date:** 2026-02-26
**Context:** In stripe.service.ts portal configuration, wrote `this.config.get('FRONTEND_URL') || 'https://propertyiq.app'` — a hardcoded fallback for a config value. CLAUDE.md Section 1.2 explicitly forbids this: "NEVER hardcode fallback values for secrets (e.g., `process.env.KEY || 'default'`). The app MUST crash if a secret is missing."

**Rule:** When a config/env value is required, throw an error if it's missing. Never provide a default URL, key, or secret. This applies to ALL config reads, not just obvious secrets like API keys.

**Wrong behavior:**

- `config.get('FRONTEND_URL') || 'https://propertyiq.app'`
- `process.env.KEY || 'fallback'`

**Correct behavior:**

- Check for the value, throw `ServiceUnavailableException` if missing
- Or use a guard method like `getFrontendUrl()` that throws on null

## Read CLAUDE.md and lessons.md at Session Start — Every Time

**Date:** 2026-02-26
**Context:** Continued from a compacted session and jumped straight into implementation without re-reading CLAUDE.md or lessons.md. This led to violating the hardcoded fallback rule and pushing without full verification — mistakes that were explicitly documented in both files.

**Rule:** At the start of EVERY session (including continuations from compacted context), read `tasks/lessons.md` and re-familiarize with CLAUDE.md critical sections before writing any code. The compacted summary does not substitute for reading the actual rules.

## Dispatch Background Validation Agents After Implementing Features

**Date:** 2026-02-26
**Context:** Implemented billing portal plan switching (touched payments code), committed and pushed without dispatching the security-reviewer agent. CLAUDE.md Section 1.6 requires automatic background dispatch of security-reviewer when touching auth, payments, or secrets.

**Rule:** After implementing any feature, dispatch the relevant validation agents in the background BEFORE committing. Don't wait for the user to ask. Check the trigger table in CLAUDE.md Section 1.6.

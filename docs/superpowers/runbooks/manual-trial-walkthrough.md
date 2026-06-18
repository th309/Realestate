# Manual Trial Walkthrough

Drive a real account through the full 14-day trial yourself, at your own pace,
to verify the welcome stream end to end: signup + OTP, the tour, feature
tracking, logout/login persistence, "what to try next" suggestions, the email
drip + countdown, and expiry.

## Prerequisites

- Local stack running: `npm run dev:fresh` (frontend :3000, backend :3001).
- Backend env (local only) has `DEV_WALKTHROUGH_ENABLED=true`, `ALLOW_DEV_AUTH=true`,
  and a real `RESEND_API_KEY` (so emails actually send).
- Run the control tool from **Git Bash**.
- Use a fresh email alias so you don't collide with automated tests, e.g.
  `troyhouston76+manual@gmail.com` (Gmail delivers `+anything` to your inbox).

The control tool (every email is scoped to the one account you pass):

```bash
bash scripts/trial-walkthrough.sh status  <email>          # show trial state + emails sent
bash scripts/trial-walkthrough.sh jump    <email> <day>    # advance to trial day + send that day's email
bash scripts/trial-walkthrough.sh email   <email> <job>    # send one email by name
bash scripts/trial-walkthrough.sh reset   <email>          # delete the account and start over
# day → email:  0=welcome 1/3/5/7=onboarding  10="4 days left" 13="last chance" 15="trial ended"
```

## Walkthrough

**1. Sign up (Day 0).** Open http://localhost:3000/auth/sign-up, register with your
alias + a password. Read the 6-digit code from your inbox and enter it.
→ Verify: you land in the tour; the header shows a "14d Pro Trial" badge.

**2. Walk the tour.** Pick a persona and a market. The finale generates a
listing-presentation report.
→ Verify the FIX: the finale resolves (real content, or a graceful fallback) — it
does not spin forever. After the tour, click around the app (Explore, Markets,
Analyzer). The tour coach-mark spotlight must NOT follow you onto those pages.

**3. Use a feature, then log out and back in.** View a market's PropertyIQ Score,
or run the analyzer. Then log out and log back in.
→ Verify: your dashboard's "what to try next" card reflects what you've used and
persists across the session; your usage didn't reset.

**4. Step through the days + emails.** For each day, run e.g.:

```bash
bash scripts/trial-walkthrough.sh jump troyhouston76+manual@gmail.com 1
```

then reload the app and check your inbox. Walk: `1 → 3 → 5 → 7 → 10 → 13`.
→ Verify the FIXES:

- Each email arrives (welcome + onboarding days, then "4 days left" at 10 and
  "last chance" at 13 — the countdown emails that previously never sent).
- Every link in those emails points to **https://propertyiq.app**, never
  localhost.
- The app's trial countdown reflects the day you jumped to.

**5. Expiry (Day 15).**

```bash
bash scripts/trial-walkthrough.sh jump troyhouston76+manual@gmail.com 15
```

→ Verify: the "trial has ended" email arrives; reload the app — you're now on the
free tier with the post-trial state (personalized to what you used).

**6. Reset / repeat.**

```bash
bash scripts/trial-walkthrough.sh reset troyhouston76+manual@gmail.com
```

`status` at any point prints the trial row and every email logged for the account.

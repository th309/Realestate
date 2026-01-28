# Quinn Iterative Testing

Use the **Quinn iterative test script** to run many prompts against the analytics-chat backend and get pass/fail and timing without manual UI testing.

**Backend:** The script targets the Railway backend by default. No local backend needed.

## Quick start

From repo root:
```bash
npm run quinn:test
```

This uses built-in prompts. For your own list, put one prompt per line in a file (e.g. `prompts.txt`) and run:

```bash
npm run quinn:test -- prompts.txt
```

## What it does

- Sends each prompt to `POST /analytics/chat/:conversationId` on the backend
- Prints `OK <duration>ms` or `FAIL <error>` per prompt
- Prints a summary: passed/failed counts and average response time
- Exits with 0 if all pass, 1 if any fail (usable in CI)

## Backend URL

- Default: Railway — `https://backend-production-ee4d.up.railway.app`
- Override: `QUINN_TEST_BACKEND_URL`, `BACKEND_URL`, or `NEXT_PUBLIC_API_URL`; or `--url <url>`:
  ```bash
  npx tsx scripts/quinn-test/run-iterative.ts --url http://localhost:3001
  ```

## Prompts file format

- One prompt per line
- Lines starting with `#` are ignored
- See `scripts/quinn-test/prompts.example.txt`

Example:

```text
# My Quinn tests
Find hot markets
Compare Texas metros to the national average
What are Austin home prices?
```

## Automation

- **Cursor**: The rule in `.cursor/rules/quinn-iterative-test.mdc` tells the AI to run this script when you ask to “iteratively test Quinn” or “automate Quinn testing”.
- **CI**: Run `npm run quinn:test` (or with a prompts file); fail the job when exit code is 1.

## Full details

See `scripts/quinn-test/README.md`.

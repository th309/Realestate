# Quinn Iterative Test Runner

Run many prompts against the Quinn analytics-chat backend and get a pass/fail and timing summary—no manual UI testing.

**Backend:** Uses the Railway backend by default (`https://backend-production-ee4d.up.railway.app`). No local backend needed.

## Prerequisites

- None for default setup. The backend runs on Railway; the script talks to it over HTTPS.

## Usage

**Default prompts (built-in list):**
```bash
npx tsx scripts/quinn-test/run-iterative.ts
```

**Custom prompts file (one prompt per line, `#` = comment):**
```bash
npx tsx scripts/quinn-test/run-iterative.ts prompts.txt
```

**Different backend URL** (e.g. local):
```bash
npx tsx scripts/quinn-test/run-iterative.ts --url http://localhost:3001
# or
QUINN_TEST_BACKEND_URL=http://localhost:3001 npx tsx scripts/quinn-test/run-iterative.ts
```

**From repo root via npm (if added to root package.json):**
```bash
npm run quinn:test
npm run quinn:test -- prompts.txt
```

## Output

For each prompt you get:

- `OK <duration>ms` or `FAIL <error>`
- A short summary: passed/failed counts and average response time.

Exit code is `0` when all pass, `1` when any fail (suitable for CI).

## Example prompts file

See `prompts.example.txt`. Copy and edit:

```bash
cp scripts/quinn-test/prompts.example.txt scripts/quinn-test/prompts.txt
# edit prompts.txt, then:
npx tsx scripts/quinn-test/run-iterative.ts scripts/quinn-test/prompts.txt
```

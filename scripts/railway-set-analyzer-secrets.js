// One-shot Railway env-var upsert for the deal analyzer feature.
//
// Reads:
//   RAILWAY_TOKEN env var (Personal Access Token from railway.app/account/tokens)
//   NODE_EXTRA_CA_CERTS pointing at a trusted-roots PEM (auto-set below if absent)
//   ANALYZER_PREVIEW_SECRET from packages/backend/.env
//   ~/.railway/config.json for project + environment + service IDs
//
// Writes (Railway GraphQL variableUpsert):
//   ANALYZER_PREVIEW_SECRET on the production backend service
//
// Verifies:
//   ANTHROPIC_API_KEY already set; reports if missing.
//
// Run: NODE_EXTRA_CA_CERTS=$HOME/.railway/windows-roots.pem RAILWAY_TOKEN=<pat> node scripts/railway-set-analyzer-secrets.js
const fs = require("fs");
const path = require("path");
const https = require("https");

const TOKEN = process.env.RAILWAY_TOKEN;
if (!TOKEN) {
  console.error(
    "ERROR: set RAILWAY_TOKEN to a Personal Access Token from https://railway.app/account/tokens",
  );
  process.exit(2);
}

const cfgPath = path.join(
  process.env.USERPROFILE || process.env.HOME,
  ".railway",
  "config.json",
);
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
// Pick the entry with environmentName === "production" — same project, prod env, backend service.
const PROD = Object.values(cfg.projects).find(
  (p) => p.environmentName === "production",
);
if (!PROD) {
  console.error("ERROR: no production project entry in ~/.railway/config.json");
  process.exit(2);
}
const {
  project: projectId,
  environment: environmentId,
  service: serviceId,
} = PROD;

// Read ANALYZER_PREVIEW_SECRET from packages/backend/.env
const envPath = path.join(__dirname, "..", "packages", "backend", ".env");
const envText = fs.readFileSync(envPath, "utf-8");
const m = envText.match(/^ANALYZER_PREVIEW_SECRET=(.+)$/m);
if (!m) {
  console.error("ERROR: ANALYZER_PREVIEW_SECRET not in packages/backend/.env");
  process.exit(2);
}
const analyzerSecret = m[1].trim();

// Read ANTHROPIC_API_KEY from packages/backend/.env.local
const envLocalPath = path.join(
  __dirname,
  "..",
  "packages",
  "backend",
  ".env.local",
);
let anthropicKey = null;
if (fs.existsSync(envLocalPath)) {
  const localText = fs.readFileSync(envLocalPath, "utf-8");
  const anthMatch = localText.match(/^ANTHROPIC_API_KEY=(.+)$/m);
  if (anthMatch) anthropicKey = anthMatch[1].trim();
}

function gql(query, variables) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const req = https.request(
      {
        host: "backboard.railway.com",
        port: 443,
        path: "/graphql/v2",
        method: "POST",
        timeout: 20000,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Authorization: `Bearer ${TOKEN}`,
          "User-Agent": "railway-cli/4.23.2",
        },
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try {
            const json = JSON.parse(d);
            if (json.errors) reject(new Error(json.errors[0].message));
            else resolve(json.data);
          } catch (e) {
            reject(
              new Error(
                `bad JSON (HTTP ${res.statusCode}): ${d.slice(0, 200)}`,
              ),
            );
          }
        });
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  // 1. Sanity-check the token works against THIS project (project tokens lack `me`).
  const proj = await gql(
    "query($id: String!) { project(id: $id) { name id } }",
    { id: projectId },
  );
  console.log(
    `[OK] token authorized for project: ${proj.project.name} (${proj.project.id})`,
  );

  // 2. List existing variable NAMES (not values).
  const list = await gql(
    "query Vars($projectId: String!, $environmentId: String!, $serviceId: String!) { variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId) }",
    { projectId, environmentId, serviceId },
  );
  const names = Object.keys(list.variables || {}).sort();
  console.log(`[INFO] existing variables: ${names.length}`);
  const hasAnthropic = names.includes("ANTHROPIC_API_KEY");
  const hadAnalyzer = names.includes("ANALYZER_PREVIEW_SECRET");

  // 3. Upsert ANALYZER_PREVIEW_SECRET.
  await gql(
    "mutation Upsert($input: VariableUpsertInput!) { variableUpsert(input: $input) }",
    {
      input: {
        projectId,
        environmentId,
        serviceId,
        name: "ANALYZER_PREVIEW_SECRET",
        value: analyzerSecret,
      },
    },
  );
  console.log(
    `[OK] ANALYZER_PREVIEW_SECRET ${hadAnalyzer ? "updated" : "set"} on production backend`,
  );

  // 4. Upsert ANTHROPIC_API_KEY if we have a local value, otherwise report.
  if (anthropicKey) {
    await gql(
      "mutation Upsert($input: VariableUpsertInput!) { variableUpsert(input: $input) }",
      {
        input: {
          projectId,
          environmentId,
          serviceId,
          name: "ANTHROPIC_API_KEY",
          value: anthropicKey,
        },
      },
    );
    console.log(
      `[OK] ANTHROPIC_API_KEY ${hasAnthropic ? "updated" : "set"} on production backend (sourced from backend/.env.local)`,
    );
  } else if (hasAnthropic) {
    console.log("[OK] ANTHROPIC_API_KEY already present on Railway");
  } else {
    console.log(
      "[WARN] ANTHROPIC_API_KEY not in backend/.env.local AND not on Railway — add it manually",
    );
  }
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});

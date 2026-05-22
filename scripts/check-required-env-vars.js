#!/usr/bin/env node
// Required-env-var auditor.
//
// Why this exists:
//   CLAUDE.md §1.2 says secrets MUST crash the app if missing -- no defaults.
//   In practice that means lines like
//     if (!process.env.X) throw new Error('X is required');
//   Production outages have happened because someone shipped that code without
//   adding X to the Railway service's variables (see ANALYZER_PREVIEW_SECRET,
//   2026-05-22). This script catches that gap at PR time instead of midnight.
//
// What it does:
//   1. Scans the configured source dirs for throw new Error('NAME is required')
//      patterns and extracts NAME from the error message itself (which is
//      always identical to the env-var name by convention).
//   2. Prints the required set per scanned package.
//   3. If RAILWAY_TOKEN and RAILWAY_*_SERVICE_ID env vars are set, queries
//      Railway's GraphQL API for each service's variable names and reports any
//      required names that are missing. Exits 1 if any are missing.
//   4. Without a token, exits 0 -- the static list still gets printed so PR
//      reviewers can eyeball changes.
//
// CI wiring is in .github/workflows/ci.yml. RAILWAY_TOKEN comes from a repo
// secret (Personal Access Token from https://railway.app/account/tokens).
// Service IDs are workflow inputs -- they're not secret, just non-public IDs.

const fs = require("fs");
const path = require("path");
const https = require("https");

const REPO_ROOT = path.resolve(__dirname, "..");

const PACKAGES = [
  {
    label: "backend",
    sourceDir: path.join(REPO_ROOT, "packages", "backend", "src"),
    serviceIdEnv: "RAILWAY_BACKEND_SERVICE_ID",
  },
  {
    label: "mcp-server",
    sourceDir: path.join(REPO_ROOT, "packages", "mcp-server", "src"),
    serviceIdEnv: "RAILWAY_MCP_SERVER_SERVICE_ID",
  },
];

// Captures the env var name from the error message. By convention NAME matches
// the process.env.NAME read on the line above.
const REQUIRED_PATTERN =
  /throw new Error\(['"`]([A-Z_][A-Z0-9_]+)\s+is required/g;

function isTestFile(filePath) {
  return (
    filePath.includes("__tests__") || /\.(test|spec)\.tsx?$/.test(filePath)
  );
}

function walkSourceFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const out = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist") continue;
        stack.push(full);
      } else if (
        entry.isFile() &&
        /\.tsx?$/.test(entry.name) &&
        !isTestFile(full)
      ) {
        out.push(full);
      }
    }
  }
  return out;
}

function findRequiredVarsInFile(filePath) {
  const text = fs.readFileSync(filePath, "utf-8");
  const names = new Set();
  let m;
  REQUIRED_PATTERN.lastIndex = 0;
  while ((m = REQUIRED_PATTERN.exec(text)) !== null) {
    names.add(m[1]);
  }
  return { filePath, names: [...names] };
}

function collectRequiredVars(sourceDir) {
  const files = walkSourceFiles(sourceDir);
  const all = new Map();
  for (const file of files) {
    const { names } = findRequiredVarsInFile(file);
    for (const name of names) {
      if (!all.has(name)) all.set(name, []);
      all.get(name).push(path.relative(REPO_ROOT, file));
    }
  }
  return all;
}

function gql(token, query, variables) {
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
          Authorization: "Bearer " + token,
          "User-Agent": "check-required-env-vars/1.0",
        },
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try {
            const json = JSON.parse(d);
            if (json.errors) return reject(new Error(json.errors[0].message));
            resolve(json.data);
          } catch (e) {
            reject(
              new Error(
                "bad JSON (HTTP " + res.statusCode + "): " + d.slice(0, 200),
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

async function fetchRailwayVarNames(
  token,
  projectId,
  environmentId,
  serviceId,
) {
  const data = await gql(
    token,
    "query Vars($projectId: String!, $environmentId: String!, $serviceId: String!) { variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId) }",
    { projectId, environmentId, serviceId },
  );
  return new Set(Object.keys(data.variables || {}));
}

async function main() {
  const token = process.env.RAILWAY_TOKEN;
  const projectId = process.env.RAILWAY_PROJECT_ID;
  const environmentId = process.env.RAILWAY_ENVIRONMENT_ID;
  const canDiff = Boolean(token && projectId && environmentId);

  let hadFailure = false;

  for (const pkg of PACKAGES) {
    const required = collectRequiredVars(pkg.sourceDir);
    const requiredNames = [...required.keys()].sort();
    console.log("\n=== " + pkg.label + " ===");
    console.log("Required env vars (" + requiredNames.length + "):");
    for (const name of requiredNames) {
      const siteCount = required.get(name).length;
      console.log(
        "  " +
          name +
          "  (" +
          siteCount +
          " site" +
          (siteCount === 1 ? "" : "s") +
          ")",
      );
    }

    if (!canDiff) continue;

    const serviceId = process.env[pkg.serviceIdEnv];
    if (!serviceId) {
      console.log("  [skip Railway diff] " + pkg.serviceIdEnv + " not set");
      continue;
    }

    try {
      const railwayNames = await fetchRailwayVarNames(
        token,
        projectId,
        environmentId,
        serviceId,
      );
      const missing = requiredNames.filter((n) => !railwayNames.has(n));
      if (missing.length === 0) {
        console.log(
          "  Railway diff: all required vars present on service " + serviceId,
        );
      } else {
        console.log(
          "  Railway diff: MISSING on service " +
            serviceId +
            " (production env):",
        );
        for (const name of missing) {
          const sites = required.get(name);
          console.log("    " + name);
          for (const s of sites) console.log("      from " + s);
        }
        hadFailure = true;
      }
    } catch (err) {
      console.error("  [Railway diff failed] " + err.message);
      // Don't fail CI on a transient Railway-API hiccup -- only on confirmed
      // missing vars. Network blips shouldn't block PRs.
    }
  }

  if (!canDiff) {
    console.log(
      "\n[info] RAILWAY_TOKEN/RAILWAY_PROJECT_ID/RAILWAY_ENVIRONMENT_ID not all set -- Railway diff skipped.",
    );
  }

  if (hadFailure) {
    console.error(
      "\nERROR: code requires env vars that are missing on Railway. Add them to the production service before merging.",
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});

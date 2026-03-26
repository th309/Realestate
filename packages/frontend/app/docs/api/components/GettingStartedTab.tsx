"use client";

import { AlertTriangle } from "lucide-react";
import { CodeBlock } from "./CodeBlock";
import { CodeTabs } from "./CodeTabs";

const API_BASE = "https://backend-production-ee4d.up.railway.app";

// ─── Step 2: Health check examples ────────────────────────────────────────────

const healthCheckExamples = [
  {
    language: "bash",
    label: "curl",
    code: `curl -H "Authorization: Bearer YOUR_API_KEY" \\
  ${API_BASE}/api/v1/health`,
  },
  {
    language: "javascript",
    label: "JavaScript",
    code: `const response = await fetch(
  "${API_BASE}/api/v1/health",
  { headers: { "Authorization": "Bearer YOUR_API_KEY" } }
);
const data = await response.json();
console.log(data);`,
  },
  {
    language: "python",
    label: "Python",
    code: `import requests

response = requests.get(
    "${API_BASE}/api/v1/health",
    headers={"Authorization": "Bearer YOUR_API_KEY"}
)
print(response.json())`,
  },
];

const healthCheckSuccessResponse = `{
  "data": {
    "status": "ok",
    "organization": "Your Brokerage Name",
    "scopes": ["scores:read", "metrics:read"],
    "rate_limit_rpm": 120
  },
  "meta": { "request_id": "req_...", "timestamp": "..." }
}`;

// ─── Step 3: First real call examples ─────────────────────────────────────────

const firstCallExamples = [
  {
    language: "bash",
    label: "curl",
    code: `curl -X POST \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"geography_type": "zip", "geography_id": "90210", "score_type": "homeready"}' \\
  ${API_BASE}/api/v1/reports`,
  },
  {
    language: "javascript",
    label: "JavaScript",
    code: `const response = await fetch(
  "${API_BASE}/api/v1/reports",
  {
    method: "POST",
    headers: {
      "Authorization": "Bearer YOUR_API_KEY",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      geography_type: "zip",
      geography_id: "90210",
      score_type: "homeready",
    }),
  }
);
const data = await response.json();
console.log(data);`,
  },
  {
    language: "python",
    label: "Python",
    code: `import requests

response = requests.post(
    "${API_BASE}/api/v1/reports",
    headers={
        "Authorization": "Bearer YOUR_API_KEY",
        "Content-Type": "application/json",
    },
    json={
        "geography_type": "zip",
        "geography_id": "90210",
        "score_type": "homeready",
    }
)
print(response.json())`,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function GettingStartedTab() {
  return (
    <div className="space-y-12">
      {/* ── Step 1: Create Your API Key ── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-on-primary text-sm font-medium shrink-0">
            1
          </span>
          <h2 className="text-xl font-medium text-on-surface">
            Create Your API Key
          </h2>
        </div>

        <p className="text-sm text-on-surface-variant mb-4">
          An API key is like a password that lets your other tools pull data
          from PropertyIQ automatically. You create it once, paste it into your
          website or tool, and PropertyIQ knows it&apos;s you.
        </p>

        <ol className="space-y-2 mb-5">
          {[
            "Go to your org's Admin panel.",
            <>
              Click{" "}
              <strong className="text-on-surface font-medium">API Keys</strong>{" "}
              in the sidebar.
            </>,
            <>
              Click{" "}
              <strong className="text-on-surface font-medium">
                Create Key
              </strong>
              .
            </>,
            <>
              Give it a recognizable name — for example,{" "}
              <span className="font-mono text-xs bg-surface-container px-1.5 py-0.5 rounded text-on-surface">
                My Website
              </span>
              .
            </>,
            "Select the permissions you need (e.g., scores:read, metrics:read).",
            <>
              Click{" "}
              <strong className="text-on-surface font-medium">Create</strong>{" "}
              and copy your key immediately.
            </>,
          ].map((step, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-sm text-on-surface-variant"
            >
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-surface-container text-on-surface-variant text-xs font-medium shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 p-4 my-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <strong className="font-medium">
              Your key is shown only once.
            </strong>{" "}
            Copy it now and store it somewhere safe — like a password manager.
            If you lose it, you&apos;ll need to create a new one.
          </div>
        </div>

        <a
          href="/org"
          className="inline-flex items-center text-sm font-medium text-primary hover:underline"
        >
          Go to API Keys →
        </a>
      </section>

      {/* ── Step 2: Verify Your Key Works ── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-on-primary text-sm font-medium shrink-0">
            2
          </span>
          <h2 className="text-xl font-medium text-on-surface">
            Verify Your Key Works
          </h2>
        </div>

        <p className="text-sm text-on-surface-variant mb-4">
          Before building anything, let&apos;s make sure your key is working.
          Paste this into your terminal{" "}
          <span className="text-on-surface-variant italic">
            (the command-line program on your computer)
          </span>
          :
        </p>

        <CodeTabs examples={healthCheckExamples} />

        <p className="text-sm text-on-surface-variant mt-4 mb-2">
          If everything is set up correctly, you&apos;ll see a response like
          this:
        </p>

        <CodeBlock code={healthCheckSuccessResponse} language="json" />

        <p className="text-sm text-on-surface-variant mt-4">
          If you see an error instead, head to the{" "}
          <a
            href="#troubleshooting"
            className="text-primary hover:underline font-medium"
          >
            Troubleshooting tab
          </a>
          .
        </p>

        <div className="flex items-start gap-3 rounded-xl bg-surface-container-low border border-outline-variant/50 p-4 mt-4">
          <span className="text-on-surface-variant text-base mt-0.5 shrink-0">
            💡
          </span>
          <p className="text-sm text-on-surface-variant">
            <strong className="text-on-surface font-medium">Tip:</strong> If
            your key has no scopes selected, the health check will pass but data
            endpoints will return{" "}
            <span className="font-mono text-xs bg-surface-container px-1.5 py-0.5 rounded text-on-surface">
              403
            </span>
            . Make sure to select at least one permission when creating your
            key.
          </p>
        </div>
      </section>

      {/* ── Step 3: Make Your First Real Call ── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-on-primary text-sm font-medium shrink-0">
            3
          </span>
          <h2 className="text-xl font-medium text-on-surface">
            Make Your First Real Call
          </h2>
        </div>

        <p className="text-sm text-on-surface-variant mb-4">
          Now let&apos;s do something useful — generate a market report. This
          asks PropertyIQ for a{" "}
          <span className="text-on-surface-variant italic">
            (HomeReady buyer score)
          </span>{" "}
          for ZIP code 90210:
        </p>

        <CodeTabs examples={firstCallExamples} />

        {/* "Now what?" card */}
        <div className="mt-8 rounded-xl bg-surface-container-low border border-outline-variant/50 p-5">
          <h3 className="text-base font-medium text-on-surface mb-2">
            Ready for more?
          </h3>
          <p className="text-sm text-on-surface-variant mb-3">
            Now that your key is working, explore what you can build:
          </p>
          <a
            href="#use-cases"
            className="text-sm font-medium text-primary hover:underline"
          >
            See all 10 use case guides →
          </a>
        </div>
      </section>
    </div>
  );
}

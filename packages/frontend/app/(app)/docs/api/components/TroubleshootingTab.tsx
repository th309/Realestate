"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { CodeTabs } from "./CodeTabs";

// ─── Rate limit retry examples ────────────────────────────────────────────────

const retryExamples = [
  {
    language: "javascript",
    label: "JavaScript",
    code: `async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After") || "5";
      await new Promise(r => setTimeout(r, parseInt(retryAfter) * 1000));
      continue;
    }
    return response;
  }
  throw new Error("Max retries exceeded");
}`,
  },
  {
    language: "python",
    label: "Python",
    code: `import time, requests

def fetch_with_retry(url, headers, max_retries=3):
    for attempt in range(max_retries):
        response = requests.get(url, headers=headers)
        if response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", 5))
            time.sleep(retry_after)
            continue
        return response
    raise Exception("Max retries exceeded")`,
  },
];

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    question: "Can I have multiple API keys?",
    answer:
      "Yes — create one per integration so you can revoke them independently.",
  },
  {
    question: "What happens if I lose my key?",
    answer: "Create a new one. Your old key still works until you revoke it.",
  },
  {
    question: "Is there a test/sandbox environment?",
    answer:
      "Not currently. The health endpoint lets you verify safely without affecting data.",
  },
  {
    question: "How fresh is the data?",
    answer:
      "Metrics update monthly following source publication. Scores recalculate weekly.",
  },
  {
    question: "Can I use the API from a browser?",
    answer:
      "Yes, but store your key server-side. Never expose it in client-side JavaScript that users can inspect.",
  },
];

// ─── Shared table primitives ──────────────────────────────────────────────────

function TableHead({ columns }: { columns: string[] }) {
  return (
    <thead>
      <tr className="border-b border-outline-variant">
        {columns.map((col) => (
          <th
            key={col}
            className="text-left text-xs font-medium text-on-surface-variant py-2 pr-4 first:pl-0"
          >
            {col}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="text-xs bg-surface-container px-1.5 py-0.5 rounded font-mono">
      {children}
    </code>
  );
}

// ─── FAQ item ─────────────────────────────────────────────────────────────────

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-outline-variant last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 py-3 text-left"
      >
        <p className="font-medium text-on-surface text-sm">{question}</p>
        {open ? (
          <ChevronDown className="w-4 h-4 text-on-surface-variant shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-on-surface-variant shrink-0" />
        )}
      </button>
      {open && <p className="text-sm text-on-surface-variant pb-3">{answer}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TroubleshootingTab() {
  return (
    <div className="space-y-12">
      {/* ── Section 1: Key not working ── */}
      <section>
        <h2 className="text-xl font-medium text-on-surface mb-4">
          My key isn&apos;t working
        </h2>

        <table className="w-full text-sm">
          <TableHead
            columns={["What You See", "What It Means", "How to Fix It"]}
          />
          <tbody>
            <tr className="border-b border-outline-variant">
              <td className="py-3 pr-4 align-top">
                <Code>UNAUTHORIZED (401)</Code>
              </td>
              <td className="py-3 pr-4 align-top text-on-surface-variant">
                Key is missing, malformed, expired, or revoked
              </td>
              <td className="py-3 align-top text-on-surface-variant">
                Check you included <Code>Bearer </Code> before your key. Verify
                key in Admin → API Keys. If lost, create a new one.
              </td>
            </tr>
            <tr className="border-b border-outline-variant">
              <td className="py-3 pr-4 align-top">
                <Code>API_KEY_EXPIRED (401)</Code>
              </td>
              <td className="py-3 pr-4 align-top text-on-surface-variant">
                Key passed its expiration date
              </td>
              <td className="py-3 align-top text-on-surface-variant">
                Create a new key in Admin → API Keys.
              </td>
            </tr>
            <tr>
              <td className="py-3 pr-4 align-top">
                <Code>API_KEY_REVOKED (401)</Code>
              </td>
              <td className="py-3 pr-4 align-top text-on-surface-variant">
                Someone on your team revoked this key
              </td>
              <td className="py-3 align-top text-on-surface-variant">
                Check the audit log in Admin. Create a new key.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── Section 2: Error on a specific endpoint ── */}
      <section>
        <h2 className="text-xl font-medium text-on-surface mb-4">
          I&apos;m getting an error on a specific endpoint
        </h2>

        <table className="w-full text-sm">
          <TableHead
            columns={["What You See", "What It Means", "How to Fix It"]}
          />
          <tbody>
            <tr className="border-b border-outline-variant">
              <td className="py-3 pr-4 align-top">
                <Code>INSUFFICIENT_SCOPE (403)</Code>
              </td>
              <td className="py-3 pr-4 align-top text-on-surface-variant">
                Key doesn&apos;t have permission for this endpoint
              </td>
              <td className="py-3 align-top text-on-surface-variant">
                Check scopes in Admin → API Keys. Create a new key with the
                needed scope.
              </td>
            </tr>
            <tr className="border-b border-outline-variant">
              <td className="py-3 pr-4 align-top">
                <Code>RESOURCE_NOT_FOUND (404)</Code>
              </td>
              <td className="py-3 pr-4 align-top text-on-surface-variant">
                Geography ID or resource doesn&apos;t exist
              </td>
              <td className="py-3 align-top text-on-surface-variant">
                Double-check <Code>geoLevel</Code> (metro/county/zip) and{" "}
                <Code>geoId</Code> format.
              </td>
            </tr>
            <tr>
              <td className="py-3 pr-4 align-top">
                <Code>VALIDATION_ERROR (400)</Code>
              </td>
              <td className="py-3 pr-4 align-top text-on-surface-variant">
                Something wrong with request format
              </td>
              <td className="py-3 align-top text-on-surface-variant">
                Check request body against the API Reference tab. Common:
                missing required fields.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── Section 3: Rate limited ── */}
      <section>
        <h2 className="text-xl font-medium text-on-surface mb-4">
          I&apos;m being rate limited
        </h2>

        <p className="text-sm text-on-surface-variant mb-4">
          You&apos;re sending too many requests too quickly. Here&apos;s what
          the response headers tell you:
        </p>

        <table className="w-full text-sm mb-4">
          <TableHead columns={["Header", "What It Means"]} />
          <tbody>
            <tr className="border-b border-outline-variant">
              <td className="py-3 pr-4 align-top">
                <Code>X-RateLimit-Limit</Code>
              </td>
              <td className="py-3 align-top text-on-surface-variant">
                How many requests you&apos;re allowed per minute
              </td>
            </tr>
            <tr className="border-b border-outline-variant">
              <td className="py-3 pr-4 align-top">
                <Code>X-RateLimit-Remaining</Code>
              </td>
              <td className="py-3 align-top text-on-surface-variant">
                How many requests you have left in the current window
              </td>
            </tr>
            <tr className="border-b border-outline-variant">
              <td className="py-3 pr-4 align-top">
                <Code>X-RateLimit-Reset</Code>
              </td>
              <td className="py-3 align-top text-on-surface-variant">
                Unix timestamp when your limit resets (start of the next minute)
              </td>
            </tr>
            <tr>
              <td className="py-3 pr-4 align-top">
                <Code>Retry-After</Code>
              </td>
              <td className="py-3 align-top text-on-surface-variant">
                Seconds to wait before retrying (only present on 429 responses)
              </td>
            </tr>
          </tbody>
        </table>

        <p className="text-sm text-on-surface-variant mb-4">
          <strong className="text-on-surface font-medium">What to do:</strong>{" "}
          Wait until the time shown in <Code>X-RateLimit-Reset</Code>, then try
          again. Or use a retry loop with backoff:
        </p>

        <CodeTabs examples={retryExamples} />

        <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 p-3 text-sm mt-4 mb-4">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-amber-800 dark:text-amber-200">
            <strong className="font-medium">Tip:</strong> The health endpoint (
            <Code>GET /api/v1/health</Code>) doesn&apos;t count against your
            rate limit — use it to verify your key still works while you wait.
          </p>
        </div>

        <p className="text-sm text-on-surface-variant">
          Need a higher limit? You can update your key&apos;s RPM in Admin → API
          Keys, or contact support.
        </p>
      </section>

      {/* ── Section 4: Still stuck ── */}
      <section>
        <h2 className="text-xl font-medium text-on-surface mb-4">
          Everything looks right but I&apos;m still stuck
        </h2>

        <ol className="space-y-2">
          {[
            <>
              Run the health check (<Code>GET /api/v1/health</Code>) — does it
              return <Code>&quot;ok&quot;</Code>?
            </>,
            "Check your key isn't revoked in Admin → API Keys.",
            "Verify your key has the right scopes for the endpoint you're calling.",
            "Try the exact curl example from the Getting Started tab.",
            <>
              Still stuck? Email{" "}
              <a
                href="mailto:support@propertyiq.app"
                className="text-primary hover:underline font-medium"
              >
                support@propertyiq.app
              </a>{" "}
              with your <Code>request_id</Code> (found in every error response).
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
      </section>

      {/* ── Section 5: FAQ ── */}
      <section>
        <h2 className="text-xl font-medium text-on-surface mb-4">FAQ</h2>

        <div className="rounded-xl border border-outline-variant divide-y divide-outline-variant overflow-hidden px-4">
          {FAQ_ITEMS.map((item) => (
            <FaqItem
              key={item.question}
              question={item.question}
              answer={item.answer}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

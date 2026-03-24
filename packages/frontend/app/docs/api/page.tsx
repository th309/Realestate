import type { Metadata } from "next";
import { CodeBlock } from "./components/CodeBlock";
import { EndpointsReference } from "./components/EndpointsReference";
import { CodeExamplesSection } from "./components/CodeExamplesSection";
import { NAV_SECTIONS, SCOPES, ERROR_CODES } from "./components/api-docs-data";

export const metadata: Metadata = {
  title: "API Documentation",
  description:
    "PropertyIQ API documentation — access real estate analytics data programmatically.",
  alternates: { canonical: "https://www.propertyiq.app/docs/api" },
};

/* ------------------------------------------------------------------ */
/* Page component                                                      */
/* ------------------------------------------------------------------ */
export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto flex">
        {/* Sticky sidebar (desktop) */}
        <nav className="hidden lg:block w-56 shrink-0 sticky top-0 h-screen overflow-y-auto py-10 pl-6 pr-4">
          <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-4">
            On this page
          </p>
          <ul className="space-y-2">
            {NAV_SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-sm text-on-surface-variant hover:text-primary transition-colors"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main content */}
        <main className="flex-1 max-w-4xl px-6 py-10 space-y-16">
          {/* Header */}
          <header>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold text-on-surface tracking-tight">
                PropertyIQ API Documentation
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/15 text-primary">
                v1
              </span>
            </div>
            <p className="text-lg text-on-surface-variant">
              Access real estate analytics data programmatically.
            </p>
          </header>

          {/* Getting Started */}
          <section id="getting-started">
            <SectionHeading>Getting Started</SectionHeading>
            <ol className="list-decimal list-inside space-y-3 text-sm text-on-surface-variant">
              <li>
                Create an organization on the <strong>Enterprise</strong> plan.
              </li>
              <li>
                Navigate to <strong>Admin Portal &rarr; API Keys</strong> and
                generate a new key.
              </li>
              <li>Make your first request:</li>
            </ol>
            <div className="mt-4">
              <CodeBlock
                code={`curl -X GET "https://api.propertyiq.app/api/v1/scores/metro/31080" \\
  -H "Authorization: Bearer piq_live_abc123..."`}
              />
            </div>
          </section>

          {/* Authentication */}
          <section id="authentication">
            <SectionHeading>Authentication</SectionHeading>
            <p className="text-sm text-on-surface-variant mb-4">
              All requests require a Bearer token in the{" "}
              <code className="text-xs bg-surface-container px-1.5 py-0.5 rounded">
                Authorization
              </code>{" "}
              header. API keys are scoped to your organization and can be
              restricted to specific endpoint groups.
            </p>
            <CodeBlock code={`Authorization: Bearer piq_live_...`} />

            <h3 className="text-base font-medium text-on-surface mt-6 mb-3">
              Available Scopes
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant text-left text-on-surface-variant">
                    <th className="py-2 pr-4 font-medium">Scope</th>
                    <th className="py-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {SCOPES.map((s) => (
                    <tr
                      key={s.scope}
                      className="border-b border-outline-variant/50"
                    >
                      <td className="py-2 pr-4 font-mono text-xs text-primary">
                        {s.scope}
                      </td>
                      <td className="py-2 text-on-surface-variant">
                        {s.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Rate Limiting */}
          <section id="rate-limiting">
            <SectionHeading>Rate Limiting</SectionHeading>
            <p className="text-sm text-on-surface-variant mb-4">
              Each API key has a configurable rate limit (60, 120, 300, or 600
              requests per minute). Rate limit status is included in every
              response via headers:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant text-left text-on-surface-variant">
                    <th className="py-2 pr-4 font-medium">Header</th>
                    <th className="py-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-outline-variant/50">
                    <td className="py-2 pr-4 font-mono text-xs">
                      X-RateLimit-Limit
                    </td>
                    <td className="py-2 text-on-surface-variant">
                      Max requests per window
                    </td>
                  </tr>
                  <tr className="border-b border-outline-variant/50">
                    <td className="py-2 pr-4 font-mono text-xs">
                      X-RateLimit-Remaining
                    </td>
                    <td className="py-2 text-on-surface-variant">
                      Requests remaining in current window
                    </td>
                  </tr>
                  <tr className="border-b border-outline-variant/50">
                    <td className="py-2 pr-4 font-mono text-xs">
                      X-RateLimit-Reset
                    </td>
                    <td className="py-2 text-on-surface-variant">
                      Unix timestamp when the window resets
                    </td>
                  </tr>
                  <tr className="border-b border-outline-variant/50">
                    <td className="py-2 pr-4 font-mono text-xs">Retry-After</td>
                    <td className="py-2 text-on-surface-variant">
                      Seconds to wait (only on 429 responses)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Response Format */}
          <section id="response-format">
            <SectionHeading>Response Format</SectionHeading>

            <h3 className="text-base font-medium text-on-surface mb-2">
              Success
            </h3>
            <CodeBlock
              code={`{
  "data": { ... },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-03-24T12:00:00Z",
    "rate_limit": {
      "limit": 300,
      "remaining": 298,
      "reset": 1742832060
    }
  }
}`}
              language="json"
            />

            <h3 className="text-base font-medium text-on-surface mt-6 mb-2">
              Error
            </h3>
            <CodeBlock
              code={`{
  "error": {
    "code": "METRIC_NOT_FOUND",
    "message": "Metric 'invalid_id' does not exist.",
    "request_id": "req_abc123"
  }
}`}
              language="json"
            />

            <h3 className="text-base font-medium text-on-surface mt-6 mb-2">
              Pagination (cursor-based)
            </h3>
            <CodeBlock
              code={`{
  "data": [ ... ],
  "meta": {
    "pagination": {
      "total": 925,
      "limit": 50,
      "next_cursor": "eyJpZCI6NTB9"
    }
  }
}`}
              language="json"
            />
          </section>

          {/* Endpoints */}
          <section id="endpoints">
            <SectionHeading>Endpoints Reference</SectionHeading>
            <EndpointsReference />
          </section>

          {/* Error Codes */}
          <section id="error-codes">
            <SectionHeading>Error Codes</SectionHeading>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant text-left text-on-surface-variant">
                    <th className="py-2 pr-4 font-medium">Code</th>
                    <th className="py-2 pr-4 font-medium">HTTP Status</th>
                    <th className="py-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {ERROR_CODES.map((e) => (
                    <tr
                      key={e.code}
                      className="border-b border-outline-variant/50"
                    >
                      <td className="py-2 pr-4 font-mono text-xs text-error">
                        {e.code}
                      </td>
                      <td className="py-2 pr-4 text-on-surface-variant">
                        {e.status}
                      </td>
                      <td className="py-2 text-on-surface-variant">
                        {e.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Code Examples */}
          <section id="code-examples">
            <SectionHeading>Code Examples</SectionHeading>
            <CodeExamplesSection />
          </section>
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section heading helper                                              */
/* ------------------------------------------------------------------ */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl font-bold text-on-surface tracking-tight mb-4">
      {children}
    </h2>
  );
}

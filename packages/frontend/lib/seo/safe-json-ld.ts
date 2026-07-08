/**
 * Serialize a JSON-LD object for embedding in a <script type="application/ld+json">
 * tag. JSON.stringify does NOT escape "<", and the HTML parser terminates a
 * script element on a literal "</script>" even inside a JS string — so any
 * data-sourced string (tier names, geo names) could otherwise break out of the
 * tag and inject markup. Escaping "<" as the < JSON escape is the
 * standard fix and is transparent to JSON-LD consumers.
 */
export function safeJsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

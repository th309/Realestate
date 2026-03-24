import { CodeBlock } from "./CodeBlock";

/**
 * JavaScript and Python code examples for the API docs page.
 * Extracted to keep page.tsx under the 400-line limit.
 */
export function CodeExamplesSection() {
  return (
    <>
      <h3 className="text-base font-medium text-on-surface mb-2">
        JavaScript (fetch)
      </h3>
      <CodeBlock
        code={`const API_KEY = "piq_live_abc123...";

const response = await fetch(
  "https://api.propertyiq.app/api/v1/scores/metro/31080",
  { headers: { Authorization: \`Bearer \${API_KEY}\` } }
);

const { data } = await response.json();
console.log(data.homeready.score); // 82`}
        language="javascript"
      />

      <h3 className="text-base font-medium text-on-surface mt-6 mb-2">
        Python (requests)
      </h3>
      <CodeBlock
        code={`import requests

API_KEY = "piq_live_abc123..."
headers = {"Authorization": f"Bearer {API_KEY}"}

resp = requests.get(
    "https://api.propertyiq.app/api/v1/scores/metro/31080",
    headers=headers,
)
data = resp.json()["data"]
print(data["homeready"]["score"])  # 82`}
        language="python"
      />
    </>
  );
}

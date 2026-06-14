import { CodeBlock } from "./CodeBlock";

interface QueryParam {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}

interface EndpointSectionProps {
  id?: string;
  method: "GET" | "POST" | "DELETE" | "PUT" | "PATCH";
  path: string;
  description: string;
  queryParams?: QueryParam[];
  curlExample: string;
  responseExample: string;
  scope: string;
  bodyParams?: QueryParam[];
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-green-700/20 text-green-400",
  POST: "bg-blue-700/20 text-blue-400",
  DELETE: "bg-red-700/20 text-red-400",
  PUT: "bg-amber-700/20 text-amber-400",
  PATCH: "bg-amber-700/20 text-amber-400",
};

/**
 * Reusable endpoint documentation block.
 * Renders method badge, path, params table, and code examples.
 */
export function EndpointSection({
  id,
  method,
  path,
  description,
  queryParams,
  curlExample,
  responseExample,
  scope,
  bodyParams,
}: EndpointSectionProps) {
  return (
    <div
      id={id}
      className="border border-outline-variant rounded-xl overflow-hidden"
    >
      {/* Endpoint header */}
      <div className="bg-surface-container-low px-5 py-4 flex items-center gap-3 flex-wrap">
        <span
          className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wide ${METHOD_COLORS[method] ?? "bg-surface-container text-on-surface"}`}
        >
          {method}
        </span>
        <code className="text-sm font-mono text-on-surface break-all">
          {path}
        </code>
        <span className="ml-auto text-xs text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
          {scope}
        </span>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">
        <p className="text-sm text-on-surface-variant">{description}</p>

        {/* Query parameters */}
        {queryParams && queryParams.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-2">
              Query Parameters
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant text-left text-on-surface-variant">
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 pr-4 font-medium">Type</th>
                    <th className="py-2 pr-4 font-medium">Required</th>
                    <th className="py-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {queryParams.map((param) => (
                    <tr
                      key={param.name}
                      className="border-b border-outline-variant/50"
                    >
                      <td className="py-2 pr-4 font-mono text-xs text-primary">
                        {param.name}
                      </td>
                      <td className="py-2 pr-4 text-on-surface-variant">
                        {param.type}
                      </td>
                      <td className="py-2 pr-4">
                        {param.required ? (
                          <span className="text-xs text-error">required</span>
                        ) : (
                          <span className="text-xs text-on-surface-variant">
                            optional
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-on-surface-variant">
                        {param.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Body parameters (for POST/PUT) */}
        {bodyParams && bodyParams.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-2">
              Body Parameters (JSON)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant text-left text-on-surface-variant">
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 pr-4 font-medium">Type</th>
                    <th className="py-2 pr-4 font-medium">Required</th>
                    <th className="py-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {bodyParams.map((param) => (
                    <tr
                      key={param.name}
                      className="border-b border-outline-variant/50"
                    >
                      <td className="py-2 pr-4 font-mono text-xs text-primary">
                        {param.name}
                      </td>
                      <td className="py-2 pr-4 text-on-surface-variant">
                        {param.type}
                      </td>
                      <td className="py-2 pr-4">
                        {param.required ? (
                          <span className="text-xs text-error">required</span>
                        ) : (
                          <span className="text-xs text-on-surface-variant">
                            optional
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-on-surface-variant">
                        {param.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* cURL example */}
        <div>
          <h4 className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-2">
            Example Request
          </h4>
          <CodeBlock code={curlExample} language="bash" />
        </div>

        {/* Response example */}
        <div>
          <h4 className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-2">
            Example Response
          </h4>
          <CodeBlock code={responseExample} language="json" />
        </div>
      </div>
    </div>
  );
}

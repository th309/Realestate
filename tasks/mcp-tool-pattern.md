# MCP Tool Registration Pattern (Phase 7.1 recon)

**Source files inspected:** `packages/mcp-server/src/server.ts`, `src/tools/core.ts`, `src/tools/agents.ts`.

## Tool object shape

Each tool is a plain object literal in an exported array:

```ts
export const coreTools = [
  {
    name: "search_markets",                // string, snake_case
    description: "...",                     // string
    schema: { query: z.string()... },       // Record<string, ZodType> (NOT a z.object())
    handler: async (args: any) => {         // returns string (JSON)
      const data = await fetchApi("/api/...", { ... });
      return JSON.stringify(data, null, 2);
    },
  },
];
```

Note: `schema` is a **flat record of zod types**, not `z.object({...})`. The MCP SDK `.tool()` call accepts the bare shape and wraps it internally.

## HTTP helper

`fetchApi(path, params?)` from `../lib/api-client` performs the backend fetch, attaches `x-user-id` from session context, throws `ApiError` on non-2xx. Path is relative to `config.apiUrl`. Second arg is a flat key/value record that becomes URL search params (undefined values dropped).

## Registration in `server.ts`

1. Import each tool array (`coreTools`, `agentTools`, etc.).
2. Spread into the flat `ALL_TOOLS` constant.
3. `createServer()` loops `ALL_TOOLS` and calls a typed-narrowed `register(name, description, schema, cb)`.
4. The callback wraps `tool.handler(args)` in try/catch, returning `{ content: [{ type: "text", text }, { type: "text", text: DATA_DISCLAIMER }] }` on success or `{ content: [...], isError: true }` on error.

## Adding a new tool array

1. Create `src/tools/<name>.ts` exporting `export const <name>Tools = [ {...}, ... ];`.
2. In `src/tools/<name>.ts`, define handlers as `async (args: any) => JSON.stringify(...)`.
3. In `server.ts`: import the array and append it inside the `ALL_TOOLS` spread.

## Test pattern

Vitest (`npm test` → `vitest run`). Existing tests (e.g. `src/lib/auth-http.test.ts`) use `vi.mock(...)` for module-level mocks and `vi.mocked(fn)` for typed access. Place new specs at `src/tools/__tests__/<feature>.spec.ts` (or co-located `.test.ts`); vitest discovers both.

For tool unit tests, mock `../lib/api-client` so `fetchApi` is a `vi.fn()` and assert URL + params.

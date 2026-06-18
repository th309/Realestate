const base = process.env.PLAYWRIGHT_BASE_API || "http://localhost:3001";
const bearer = process.env.ADMIN_BEARER;
if (!bearer) throw new Error("ADMIN_BEARER required");

async function call(path: string, method: string, body?: unknown) {
  const res = await fetch(`${base}/api/admin/dev/trial-walkthrough${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${bearer}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok)
    throw new Error(`devHook ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

export const devHook = {
  advance: (userId: string, toDay: number) =>
    call("/advance", "POST", { userId, toDay }),
  fire: (job: string, userId: string) => call("/fire", "POST", { job, userId }),
  teardown: (userId: string) => call(`/user/${userId}`, "DELETE"),
};

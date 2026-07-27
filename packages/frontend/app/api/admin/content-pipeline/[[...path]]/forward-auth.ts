/**
 * Decides the Authorization header the content-pipeline proxy forwards upstream.
 *
 * The frontend's fetchAPI attaches the Supabase JWT to XHR/fetch calls, so those
 * arrive with an `authorization` header and pass straight through. But an
 * `<img src="/api/admin/content-pipeline/.../media/0">` load can't carry a
 * header, so AdminGuard 401s it and the image breaks. For those — and only for
 * GET (the image/media surface) — mint a Bearer from the caller's cookie session
 * instead. No session → forward unauthenticated and let the backend 401 exactly
 * as today. Never throws.
 *
 * Kept pure (the session mint is injected) so both paths are unit-testable
 * without a live cookie store or backend.
 */
export async function resolveForwardAuthHeader(
  request: { headers: Headers; method: string },
  mintSessionToken: () => Promise<string | null>,
): Promise<string | null> {
  const clientAuth = request.headers.get("authorization");
  // fetchAPI path — pass the client's header through untouched.
  if (clientAuth) return clientAuth;
  // Only headerless GETs (image/media loads) get a cookie-derived token.
  if (request.method !== "GET") return null;
  try {
    const token = await mintSessionToken();
    return token ? `Bearer ${token}` : null;
  } catch {
    return null;
  }
}

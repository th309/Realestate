/**
 * Converts a base64url-encoded VAPID public key (as delivered by
 * `NEXT_PUBLIC_VAPID_PUBLIC_KEY`) into the `Uint8Array` that
 * `PushManager.subscribe()`'s `applicationServerKey` option requires.
 */
// Explicit `<ArrayBuffer>` (rather than bare `Uint8Array`, which defaults to
// the wider `Uint8Array<ArrayBufferLike>`) — TS 5.7+'s stricter typed-array
// generics otherwise reject this as a `BufferSource` for
// `applicationServerKey` in use-push-subscription.ts, since ArrayBufferLike
// also covers SharedArrayBuffer.
export function urlBase64ToUint8Array(
  base64String: string,
): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

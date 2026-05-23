/**
 * Analyzer telemetry — emits share/PDF lifecycle events to the user_events
 * pipeline. Best-effort: never throws and never blocks the UI. Failures are
 * logged at debug level so they don't pollute the console in normal use.
 *
 * Events emitted by the share/PDF flow:
 *   analyzer_share_button_clicked              { is_signed_in }
 *   analyzer_pdf_button_clicked                { is_signed_in }
 *   analyzer_share_link_copied                 { token }
 *   analyzer_pdf_downloaded                    { token, from: "modal" | "toolbar" }
 *   analyzer_share_email_sent                  { token }
 *   analyzer_share_anonymous_signin_prompt_shown
 */

import { API_URL } from "@/lib/data/fetchers/base";
import { getAuthHeaders } from "@/lib/data/fetchers/auth-headers";

export type AnalyzerEventName =
  | "analyzer_share_button_clicked"
  | "analyzer_pdf_button_clicked"
  | "analyzer_share_link_copied"
  | "analyzer_pdf_downloaded"
  | "analyzer_share_email_sent"
  | "analyzer_share_anonymous_signin_prompt_shown";

export function emitAnalyzerEvent(
  name: AnalyzerEventName,
  props: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined") return;
  void (async () => {
    try {
      const authHeaders = await getAuthHeaders();
      await fetch(`${API_URL}/api/events`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ event: name, properties: props }),
        keepalive: true,
      });
    } catch {
      // Best-effort. Never let telemetry break the UI.
    }
  })();
}

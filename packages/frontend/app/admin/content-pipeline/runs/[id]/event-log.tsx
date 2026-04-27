export function EventLog({
  events,
}: {
  events: Array<{ event_type: string; payload: any; created_at: string }>;
}) {
  return (
    <div className="space-y-2 text-sm">
      {events.map((e, i) => (
        <div key={i} className="flex gap-3">
          <span className="text-outline font-mono text-xs">
            {new Date(e.created_at).toLocaleTimeString()}
          </span>
          <span>{humanize(e)}</span>
        </div>
      ))}
    </div>
  );
}

function humanize(e: { event_type: string; payload: any }): string {
  if (e.event_type === "status_changed") {
    return `State moved from ${e.payload.from} to ${e.payload.to}${e.payload.reason ? ` (${e.payload.reason})` : ""}`;
  }
  if (e.event_type === "gate_failed")
    return `Gate ${e.payload.gate} failed: ${JSON.stringify(e.payload.violations ?? []).slice(0, 80)}`;
  if (e.event_type === "generate_script_error") {
    const msg = String(e.payload?.message ?? "unknown error");
    const stack = String(e.payload?.stack_preview ?? "").replace(/\s+/g, " ");
    return `Scripting failed: ${msg}${stack ? ` | ${stack.slice(0, 280)}` : ""}`;
  }
  if (e.event_type === "verify_data_done") {
    const w = e.payload?.waived_count ?? 0;
    const waivedNote =
      typeof w === "number" && w > 0
        ? ` (${w} general-context claim(s) waived)`
        : "";
    return `Verify data: ${e.payload?.passed ? "passed" : "failed"} — ${e.payload?.violations_count ?? "?"} violation(s)${waivedNote}`;
  }
  if (e.event_type === "generate_script_done") {
    const d = e.payload?.llm_diagnostics;
    const diag =
      d && typeof d === "object"
        ? ` path=${d.generationPath ?? "?"} stop=${d.stopReason ?? "?"} max_out=${d.maxOutputTokensRequested ?? "?"} out_tok=${d.usage?.output_tokens ?? "?"}${d.successfulAttempt != null ? ` attempt=${d.successfulAttempt}` : ""}`
        : "";
    return `Script generated: ${e.payload?.full_text_words ?? "?"} words, ${e.payload?.scripts_count ?? "?"} variant(s)${diag}`;
  }
  return `${e.event_type}: ${JSON.stringify(e.payload).slice(0, 360)}`;
}

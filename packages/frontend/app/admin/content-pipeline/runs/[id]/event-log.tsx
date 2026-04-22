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
  return `${e.event_type}: ${JSON.stringify(e.payload).slice(0, 80)}`;
}

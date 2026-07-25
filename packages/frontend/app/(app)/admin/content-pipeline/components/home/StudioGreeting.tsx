/**
 * Studio greeting — the page's opening thesis. A time-of-day greeting states
 * the room, the subhead states the one job ("what do you want to make?"), and
 * a live in-flight ticker turns the abstract pipeline into a single glance
 * using the shared StatusChip vocabulary. When nothing is moving, the ticker
 * becomes a gentle nudge to start.
 */
import { StatusChip, type StatusChipTone } from "./StatusChip";

export interface InFlightCounts {
  generating: number;
  review: number;
  published: number;
  attention: number;
}

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning.";
  if (hour < 18) return "Good afternoon.";
  return "Good evening.";
}

const TICKER_ORDER: Array<{
  key: keyof InFlightCounts;
  tone: StatusChipTone;
  label: string;
}> = [
  { key: "generating", tone: "generating", label: "Generating" },
  { key: "review", tone: "review", label: "Ready to review" },
  { key: "published", tone: "published", label: "Published this week" },
  { key: "attention", tone: "attention", label: "Needs attention" },
];

export function StudioGreeting({ counts }: { counts: InFlightCounts }) {
  const visible = TICKER_ORDER.filter((entry) => counts[entry.key] > 0);

  return (
    <header className="space-y-4">
      <div>
        <h1 className="text-4xl font-light tracking-tight text-on-surface">
          {greetingForHour(new Date().getHours())}
        </h1>
        <p className="mt-1 text-lg text-on-surface-variant">
          What do you want to make today?
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        {visible.length === 0 ? (
          <span className="text-sm text-on-surface-variant">
            Nothing in flight right now — start something below.
          </span>
        ) : (
          visible.map((entry) => (
            <StatusChip
              key={entry.key}
              tone={entry.tone}
              label={entry.label}
              count={counts[entry.key]}
            />
          ))
        )}
      </div>
    </header>
  );
}

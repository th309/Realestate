"use client";

interface PrePostBarCardProps {
  pre: number;
  post: number;
  label?: string;
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}/mo`;

export function PrePostBarCard({
  pre,
  post,
  label = "Cashflow",
}: PrePostBarCardProps) {
  const max = Math.max(pre, post, 1);
  const preH = (pre / max) * 80;
  const postH = (post / max) * 80;
  const delta = post - pre;
  const arrow = delta >= 0 ? "↑" : "↓";
  const deltaColor =
    delta >= 0 ? "text-[var(--md-tertiary)]" : "text-[var(--md-error)]";
  return (
    <div
      data-pre-post-bar-card
      className="rounded-xl bg-surface border border-outline-variant p-4"
    >
      <div className="text-xs uppercase font-semibold mb-3 text-on-surface-variant">
        {label}: pre vs post refi
      </div>
      <div className="flex items-end gap-6 h-24">
        <div className="flex flex-col items-center">
          <div
            data-pre-bar
            style={{
              height: `${preH}px`,
              backgroundColor: "var(--md-outline)",
            }}
            className="w-12 rounded-t"
          />
          <div className="text-xs mt-1 font-mono">{fmt(pre)}</div>
          <div className="text-[10px] text-on-surface-variant">Pre</div>
        </div>
        <div
          className={`text-2xl font-bold ${deltaColor} self-center`}
          data-delta
        >
          {arrow} {fmt(Math.abs(delta))}
        </div>
        <div className="flex flex-col items-center">
          <div
            data-post-bar
            style={{
              height: `${postH}px`,
              backgroundColor: "var(--md-primary)",
            }}
            className="w-12 rounded-t"
          />
          <div className="text-xs mt-1 font-mono">{fmt(post)}</div>
          <div className="text-[10px] text-on-surface-variant">Post</div>
        </div>
      </div>
    </div>
  );
}

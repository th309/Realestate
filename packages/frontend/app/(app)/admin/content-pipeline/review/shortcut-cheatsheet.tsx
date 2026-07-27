"use client";
import { useEffect } from "react";
import { CHEATSHEET_GROUPS, KEYBINDINGS } from "./keybindings";
import { useKeybindingScopeFrame } from "../lib/keybinding-scope";

/**
 * Slide-in panel listing every review keybinding. Driven entirely by the
 * KEYBINDINGS / CHEATSHEET_GROUPS constants — no manual sync needed when
 * shortcuts are added or renamed.
 *
 * Pushes a 'modal' keybinding scope frame so pressing "?" again or any
 * other shortcut while open doesn't fire global handlers (the panel's own
 * Escape-to-close does, via the keydown listener on the overlay).
 */
export function ShortcutCheatsheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // Always-mounted scope frame is wrong; only push while visible.
  return open ? <CheatsheetPanel onClose={onClose} /> : null;
}

function CheatsheetPanel({ onClose }: { onClose: () => void }) {
  useKeybindingScopeFrame("modal");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-label="Keyboard shortcuts"
      className="fixed inset-0 z-50 flex items-stretch justify-end pointer-events-none"
    >
      <div
        className="absolute inset-0 bg-on-surface/30 backdrop-blur-[2px] pointer-events-auto animate-[m3-scrim-in_200ms_ease-out]"
        onClick={onClose}
      />
      <aside className="relative w-[360px] h-full bg-surface-container-high text-on-surface shadow-2xl rounded-l-[28px] p-6 overflow-y-auto pointer-events-auto animate-[cheatsheet-in_300ms_cubic-bezier(0.2,0,0,1)]">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-xl font-medium">Shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface text-2xl leading-none"
            aria-label="Close shortcuts"
          >
            ×
          </button>
        </div>

        <div className="space-y-6">
          {CHEATSHEET_GROUPS.map((group) => (
            <section key={group.heading}>
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant mb-2">
                {group.heading}
              </h3>
              <ul className="space-y-1.5">
                {group.ids.map((id) => {
                  const b = KEYBINDINGS[id];
                  return (
                    <li
                      key={id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-on-surface">{b.label}</span>
                      <kbd className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-surface-container-highest text-on-surface border border-outline-variant min-w-[2rem] text-center">
                        {b.display}
                      </kbd>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </aside>
      <style jsx global>{`
        @keyframes cheatsheet-in {
          from {
            transform: translateX(100%);
            opacity: 0.4;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

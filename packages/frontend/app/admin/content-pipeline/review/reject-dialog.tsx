"use client";
import { useEffect, useRef, useState } from "react";
import { M3Dialog } from "../components/m3-dialog";
import { useKeybindingScopeFrame } from "../lib/queue-navigator";

const COMMON_REASONS = [
  "Off-brand",
  "Factually wrong",
  "Bad market",
  "Audio quality",
  "Other",
] as const;
type Reason = (typeof COMMON_REASONS)[number];

/**
 * M3 dialog for capturing a reject reason. Replaces the old window.prompt.
 * Five quick chips for the common reasons; "Other" reveals a required
 * textarea. Cmd/Ctrl+Enter submits when the form is valid. Pushes a
 * 'modal' keybinding scope frame so global review shortcuts (J=reject,
 * X=delete, etc.) suspend while open.
 */
export function RejectDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}) {
  const [selected, setSelected] = useState<Reason>("Off-brand");
  const [otherText, setOtherText] = useState("");
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset when reopening so previous state doesn't leak between rejections.
  useEffect(() => {
    if (open) {
      setSelected("Off-brand");
      setOtherText("");
      setBusy(false);
    }
  }, [open]);

  // Focus the textarea when "Other" is picked.
  useEffect(() => {
    if (selected === "Other") {
      // Defer to next tick so the textarea has mounted.
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [selected]);

  const computedReason =
    selected === "Other" ? otherText.trim() : selected.toLowerCase();
  const canSubmit = computedReason.length > 0 && !busy;

  async function handleSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onConfirm(computedReason);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <M3Dialog
      open={open}
      onClose={busy ? () => {} : onClose}
      ariaLabel="Reject run"
      maxWidth="max-w-lg"
    >
      <ModalScopeRegistration enabled={open} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit();
            return;
          }
          // 1..5 quick-pick reason chips, but only when not typing inside the
          // textarea (otherwise typing "1" in the Other reason eats it).
          const tag = (e.target as HTMLElement).tagName;
          if (tag !== "TEXTAREA" && tag !== "INPUT" && /^[1-5]$/.test(e.key)) {
            const idx = parseInt(e.key, 10) - 1;
            if (idx >= 0 && idx < COMMON_REASONS.length) {
              e.preventDefault();
              setSelected(COMMON_REASONS[idx]);
            }
          }
        }}
      >
        <div className="p-6">
          <h2 className="text-xl font-medium text-on-surface mb-2">
            Why are we rejecting?
          </h2>
          <p className="text-sm text-on-surface-variant mb-5">
            Required. The reason is logged with the run for later analysis.
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {COMMON_REASONS.map((r, idx) => {
              const active = selected === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelected(r)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors duration-200 inline-flex items-center gap-2 ${
                    active
                      ? "bg-secondary-container text-on-secondary-container border-transparent"
                      : "bg-surface text-on-surface border-outline hover:bg-surface-container-low"
                  }`}
                >
                  <kbd className="font-mono text-[10px] opacity-60">
                    {idx + 1}
                  </kbd>
                  <span>{r}</span>
                </button>
              );
            })}
          </div>

          {selected === "Other" && (
            <textarea
              ref={textareaRef}
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              rows={3}
              placeholder="Spell out the reason…"
              className="w-full rounded-xl border border-outline bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 pb-6">
          <span className="text-xs font-mono text-on-surface-variant">
            <kbd className="font-bold">⌘↵</kbd> submit ·{" "}
            <kbd className="font-bold">esc</kbd> cancel
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-5 py-2.5 rounded-full text-sm font-medium text-on-surface hover:bg-on-surface/8 disabled:opacity-50 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-5 py-2.5 rounded-full text-sm font-medium bg-error text-on-error hover:bg-error/90 disabled:opacity-50 inline-flex items-center gap-2 transition-colors duration-200"
            >
              {busy && (
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full border-2 border-on-error/30 border-t-on-error animate-spin"
                  aria-hidden
                />
              )}
              Reject
            </button>
          </div>
        </div>
      </form>
    </M3Dialog>
  );
}

function ModalScopeRegistration({ enabled }: { enabled: boolean }) {
  // Only push the scope frame while the dialog is mounted AND open.
  // The hook's effect covers unmount; the `enabled` flag would only matter
  // if the parent kept the dialog mounted with open=false, which we don't do.
  if (!enabled) return null;
  return <ModalScopeInner />;
}
function ModalScopeInner() {
  useKeybindingScopeFrame("modal");
  return null;
}

"use client";
import { KEYBINDINGS } from "./keybindings";

/**
 * Sticky bottom action bar for the review card. Each button shows its
 * keyboard binding as an inline kbd chip — single source of truth lives in
 * KEYBINDINGS so the cheatsheet and these buttons can never drift apart.
 *
 * Approve is primary (filled). Reject and Delete use a low-emphasis error
 * style (tinted background + error text) so destructive actions read as
 * destructive without screaming red across the whole bar.
 */
export function ActionBar({
  approving,
  continuing,
  approveDisabled,
  approveTitle,
  deleteLabel,
  onApprove,
  onContinuePipeline,
  onEdit,
  onThumbnail,
  onReject,
  onSkip,
  onDelete,
  onCheatsheet,
  vertical = false,
}: {
  approving: boolean;
  continuing?: boolean;
  /** When false, Approve is shown but not clickable (e.g. pre-render review). */
  approveDisabled?: boolean;
  approveTitle?: string;
  deleteLabel: string;
  onApprove: () => void;
  /** When set with `approveDisabled`, primary action becomes “Continue pipeline” (same L shortcut). */
  onContinuePipeline?: () => void;
  onEdit: () => void;
  onThumbnail: () => void;
  onReject: () => void;
  onSkip: () => void;
  onDelete: () => void;
  onCheatsheet: () => void;
  vertical?: boolean;
}) {
  const showContinueInsteadOfApprove = Boolean(
    approveDisabled && onContinuePipeline,
  );

  const buttons = (
    <>
      {showContinueInsteadOfApprove ? (
        <ActionButton
          primary
          kbd={KEYBINDINGS.approve.display}
          label="Continue pipeline"
          onClick={onContinuePipeline!}
          busy={continuing}
          title="Re-run fact-check if the latest data gate failed; otherwise voice lint. Does not change the script."
          fullWidth={vertical}
        />
      ) : (
        <ActionButton
          primary
          kbd={KEYBINDINGS.approve.display}
          label="Approve"
          onClick={onApprove}
          busy={approving}
          disabled={approveDisabled}
          title={approveTitle}
          fullWidth={vertical}
        />
      )}
      <ActionButton
        kbd={KEYBINDINGS.edit.display}
        label="Edit script"
        onClick={onEdit}
        fullWidth={vertical}
      />
      <ActionButton
        kbd={KEYBINDINGS.thumbnail.display}
        label="Thumbnail"
        onClick={onThumbnail}
        fullWidth={vertical}
      />
      <ActionButton
        kbd={KEYBINDINGS.reject.display}
        label="Reject"
        onClick={onReject}
        tone="error"
        fullWidth={vertical}
      />
      <ActionButton
        kbd={KEYBINDINGS.skip.display}
        label="Skip"
        onClick={onSkip}
        fullWidth={vertical}
      />
      <ActionButton
        kbd={KEYBINDINGS.delete.display}
        label={deleteLabel}
        onClick={onDelete}
        tone="error"
        fullWidth={vertical}
      />
    </>
  );

  const cheatsheetButton = (
    <button
      type="button"
      onClick={onCheatsheet}
      aria-label="Show keyboard shortcuts"
      title="Keyboard shortcuts (?)"
      className={`${vertical ? "w-full" : "w-10"} h-10 rounded-full bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors duration-200 inline-flex items-center justify-center text-lg font-mono`}
    >
      ?
    </button>
  );

  if (vertical) {
    return (
      <div className="self-start flex flex-col gap-2 w-36">
        {buttons}
        <div className="mt-2">{cheatsheetButton}</div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-10 border-t border-outline-variant bg-surface-container-low backdrop-blur-md">
      <div className="px-6 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">{buttons}</div>
        {cheatsheetButton}
      </div>
    </div>
  );
}

function ActionButton({
  kbd,
  label,
  onClick,
  primary,
  tone,
  busy,
  disabled,
  title,
  fullWidth,
}: {
  kbd: string;
  label: string;
  onClick: () => void;
  primary?: boolean;
  tone?: "error";
  busy?: boolean;
  disabled?: boolean;
  title?: string;
  fullWidth?: boolean;
}) {
  const palette = primary
    ? "bg-primary text-on-primary hover:bg-primary/90"
    : tone === "error"
      ? "bg-error/10 text-error hover:bg-error/15"
      : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      title={title}
      className={`${palette} rounded-full px-4 py-2 text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50 transition-colors duration-200 ${fullWidth ? "w-full justify-start" : ""}`}
    >
      <kbd className="font-mono text-[10px] font-bold opacity-80">{kbd}</kbd>
      <span>{label}</span>
      {busy && (
        <span
          className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current/30 border-t-current animate-spin"
          aria-hidden
        />
      )}
    </button>
  );
}

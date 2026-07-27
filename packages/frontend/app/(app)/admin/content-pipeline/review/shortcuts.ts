import { useEffect } from "react";
import { KEYBINDINGS } from "./keybindings";
import { useKeybindingScope } from "../lib/keybinding-scope";

export type ShortcutHandler = () => void | Promise<void>;

/**
 * Bind keyboard shortcuts on the review page. Reads keys from KEYBINDINGS
 * (single source of truth — also used by the cheatsheet). Suspends when
 * the keybinding scope is "modal" so dialogs can capture their own keys
 * (Escape, Cmd+Enter, digit chips) without firing global review actions.
 */
export function useReviewShortcuts(handlers: {
  onApprove: ShortcutHandler;
  onReject: ShortcutHandler;
  onEdit: ShortcutHandler;
  onThumbnail: ShortcutHandler;
  onDelete: ShortcutHandler;
  onNext: ShortcutHandler;
  onPrev: ShortcutHandler;
  onSkip: ShortcutHandler;
  onMute: ShortcutHandler;
  onPlayPause: ShortcutHandler;
  onCheatsheet: ShortcutHandler;
}) {
  const { current: scope } = useKeybindingScope();

  useEffect(() => {
    if (scope !== "global") return;

    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable = (e.target as HTMLElement)?.isContentEditable;
      if (tag === "TEXTAREA" || tag === "INPUT" || isEditable) return;

      const k = e.key.toLowerCase();
      switch (k) {
        case KEYBINDINGS.approve.key:
          handlers.onApprove();
          break;
        case KEYBINDINGS.reject.key:
          handlers.onReject();
          break;
        case KEYBINDINGS.edit.key:
          handlers.onEdit();
          break;
        case KEYBINDINGS.thumbnail.key:
          handlers.onThumbnail();
          break;
        case KEYBINDINGS.delete.key:
          handlers.onDelete();
          break;
        case KEYBINDINGS.next.key:
          handlers.onNext();
          break;
        case KEYBINDINGS.prev.key:
          handlers.onPrev();
          break;
        case KEYBINDINGS.skip.key:
          handlers.onSkip();
          break;
        case KEYBINDINGS.mute.key:
          handlers.onMute();
          break;
        case KEYBINDINGS.playPause.key:
          e.preventDefault();
          handlers.onPlayPause();
          break;
        case KEYBINDINGS.cheatsheet.key:
          handlers.onCheatsheet();
          break;
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [scope, handlers]);
}

import { useEffect } from "react";

export type ShortcutHandler = () => void | Promise<void>;

export function useReviewShortcuts(handlers: {
  onApprove: ShortcutHandler;
  onApproveSchedule: ShortcutHandler;
  onReject: ShortcutHandler;
  onNext: ShortcutHandler;
  onEdit: ShortcutHandler;
  onMute: ShortcutHandler;
  onPlayPause: ShortcutHandler;
}) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      switch (e.key.toLowerCase()) {
        case "l":
          handlers.onApprove();
          break;
        case "s":
          handlers.onApproveSchedule();
          break;
        case "j":
          handlers.onReject();
          break;
        case "k":
          handlers.onNext();
          break;
        case "e":
          handlers.onEdit();
          break;
        case "m":
          handlers.onMute();
          break;
        case " ":
          e.preventDefault();
          handlers.onPlayPause();
          break;
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handlers]);
}

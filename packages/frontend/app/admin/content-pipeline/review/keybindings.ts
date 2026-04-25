/**
 * Single source of truth for review-page keyboard shortcuts.
 * Imported by `shortcuts.ts` (the actual keydown handler) and
 * `shortcut-cheatsheet.tsx` (the floating "?" reference). When adding
 * a new binding, add it here and the cheatsheet picks it up.
 *
 * Keys are matched against `event.key.toLowerCase()`, so write them lower-case.
 */

export interface KeybindingDef {
  key: string;
  display: string; // What shows in the kbd chip — uppercase letter, "Space", "?", etc.
  label: string; // Short verb phrase: "Approve", "Reject", "Skip"
}

export const KEYBINDINGS = {
  approve: { key: "l", display: "L", label: "Approve" },
  reject: { key: "j", display: "J", label: "Reject" },
  edit: { key: "e", display: "E", label: "Edit script" },
  thumbnail: { key: "t", display: "T", label: "Edit thumbnail" },
  delete: { key: "x", display: "X", label: "Delete / cancel" },
  next: { key: "k", display: "K", label: "Next" },
  prev: { key: "p", display: "P", label: "Previous" },
  skip: { key: "s", display: "S", label: "Skip (no decision)" },
  mute: { key: "m", display: "M", label: "Mute / unmute" },
  playPause: { key: " ", display: "Space", label: "Play / pause" },
  cheatsheet: { key: "?", display: "?", label: "Show shortcuts" },
} as const satisfies Record<string, KeybindingDef>;

export type KeybindingId = keyof typeof KEYBINDINGS;

/**
 * Ordered list for cheatsheet rendering — groups visually related ones.
 */
export const CHEATSHEET_GROUPS: Array<{
  heading: string;
  ids: KeybindingId[];
}> = [
  {
    heading: "Decide",
    ids: ["approve", "reject", "edit", "thumbnail", "delete"],
  },
  { heading: "Navigate", ids: ["next", "prev", "skip"] },
  { heading: "Player", ids: ["playPause", "mute"] },
  { heading: "Help", ids: ["cheatsheet"] },
];

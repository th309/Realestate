"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// ────────────────────────────────────────────────────────────────────────────
// KeybindingScope — global vs modal scope arbitration
// ────────────────────────────────────────────────────────────────────────────
// When a modal is open, global review-page shortcuts (J=reject, X=delete,
// etc.) must stop firing — otherwise typing into the reject dialog's "Other"
// textarea or the thumbnail editor's frame input triggers chaos. Components
// push 'modal' onto the stack when they mount and pop on unmount; the
// shortcuts hook reads the current top frame to decide whether to fire.

type KeybindingScope = "global" | "modal";

interface KeybindingScopeApi {
  current: KeybindingScope;
  push(scope: KeybindingScope): () => void;
}

const KeybindingScopeContext = createContext<KeybindingScopeApi | null>(null);

export function KeybindingScopeProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<KeybindingScope[]>(["global"]);

  const push = useCallback((scope: KeybindingScope) => {
    setStack((s) => [...s, scope]);
    return () => {
      setStack((s) => {
        // Remove the most recent matching frame, not all of them.
        const idx = s.lastIndexOf(scope);
        if (idx < 0) return s;
        return [...s.slice(0, idx), ...s.slice(idx + 1)];
      });
    };
  }, []);

  const api: KeybindingScopeApi = {
    current: stack[stack.length - 1],
    push,
  };

  return (
    <KeybindingScopeContext.Provider value={api}>
      {children}
    </KeybindingScopeContext.Provider>
  );
}

export function useKeybindingScope(): KeybindingScopeApi {
  const ctx = useContext(KeybindingScopeContext);
  if (!ctx)
    throw new Error(
      "useKeybindingScope must be used inside KeybindingScopeProvider",
    );
  return ctx;
}

/** Push a scope frame for the lifetime of the calling component. */
export function useKeybindingScopeFrame(scope: KeybindingScope) {
  const { push } = useKeybindingScope();
  useEffect(() => push(scope), [push, scope]);
}

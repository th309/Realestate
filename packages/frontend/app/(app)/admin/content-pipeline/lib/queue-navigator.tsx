"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * id-based review-queue navigator.
 *
 * Position is anchored to a `runId`, NOT an index — so when the underlying
 * React Query refetches and the array shifts (approve removes the current
 * run, a new run lands at the head, etc.) we re-anchor without the cursor
 * sliding onto a stale slot.
 *
 * Re-anchor priority on `items` change:
 *   1. currentId is still in items → keep it
 *   2. else: pop history until we find one that's still in items
 *   3. else: items[0] (or null if empty)
 */

export interface QueueItem {
  id: string;
  // Whatever else the ribbon needs to render — kept loose so the navigator
  // doesn't couple to RunSummary's full shape.
  market_query?: string;
  format?: string;
  thumbnail_url?: string;
  status?: string;
}

export interface QueueNavigatorApi {
  items: ReadonlyArray<QueueItem>;
  currentId: string | null;
  currentIndex: number; // -1 if no current
  totalCount: number;
  next(): void;
  prev(): void;
  skip(): void;
  jumpTo(id: string): void;
  /**
   * Use after a mutation removes the current run (approve/reject/delete).
   * Picks the next visible run before refetch lands so the UI doesn't
   * flicker through an empty state.
   */
  removeCurrent(): void;
}

const QueueNavigatorContext = createContext<QueueNavigatorApi | null>(null);

export function QueueNavigatorProvider({
  items,
  children,
}: {
  items: ReadonlyArray<QueueItem>;
  children: ReactNode;
}) {
  const [currentId, setCurrentId] = useState<string | null>(
    items[0]?.id ?? null,
  );
  const historyRef = useRef<string[]>([]);

  // Re-anchor when items change (refetch landed).
  useEffect(() => {
    if (items.length === 0) {
      setCurrentId(null);
      historyRef.current = [];
      return;
    }
    const stillThere = currentId && items.some((i) => i.id === currentId);
    if (stillThere) return;

    // Pop history until we find a survivor.
    while (historyRef.current.length > 0) {
      const prev = historyRef.current.pop()!;
      if (items.some((i) => i.id === prev)) {
        setCurrentId(prev);
        return;
      }
    }
    setCurrentId(items[0].id);
    // We intentionally don't list `currentId` as a dep — it's read inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const currentIndex = useMemo(
    () => (currentId ? items.findIndex((i) => i.id === currentId) : -1),
    [items, currentId],
  );

  const advance = useCallback(
    (toIndex: number) => {
      if (toIndex < 0 || toIndex >= items.length) return;
      if (currentId) historyRef.current.push(currentId);
      setCurrentId(items[toIndex].id);
    },
    [items, currentId],
  );

  const next = useCallback(() => {
    if (currentIndex < 0) return;
    advance(currentIndex + 1);
  }, [currentIndex, advance]);

  const prev = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const target = historyRef.current.pop()!;
    if (items.some((i) => i.id === target)) {
      setCurrentId(target);
    }
  }, [items]);

  const skip = next; // semantically distinct, mechanically identical for now

  const jumpTo = useCallback(
    (id: string) => {
      if (id === currentId) return;
      if (!items.some((i) => i.id === id)) return;
      if (currentId) historyRef.current.push(currentId);
      setCurrentId(id);
    },
    [items, currentId],
  );

  const removeCurrent = useCallback(() => {
    if (!currentId || currentIndex < 0) return;
    // Don't push removed id onto history (you can't go back to a deleted run).
    const nextIndex =
      currentIndex < items.length - 1 ? currentIndex + 1 : currentIndex - 1;
    setCurrentId(nextIndex >= 0 ? items[nextIndex].id : null);
  }, [currentId, currentIndex, items]);

  const api: QueueNavigatorApi = {
    items,
    currentId,
    currentIndex,
    totalCount: items.length,
    next,
    prev,
    skip,
    jumpTo,
    removeCurrent,
  };

  return (
    <QueueNavigatorContext.Provider value={api}>
      {children}
    </QueueNavigatorContext.Provider>
  );
}

export function useQueueNavigator(): QueueNavigatorApi {
  const ctx = useContext(QueueNavigatorContext);
  if (!ctx)
    throw new Error(
      "useQueueNavigator must be used inside QueueNavigatorProvider",
    );
  return ctx;
}

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

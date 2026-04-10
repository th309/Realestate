"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";

interface Toast {
  id: string;
  message: string;
  emoji?: string;
}

interface ToastContextValue {
  showToast: (message: string, emoji?: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timeoutsRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timeoutsRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message: string, emoji?: string) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, emoji }]);
      const timer = setTimeout(() => dismiss(id), 4000);
      timeoutsRef.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const timers = timeoutsRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          aria-atomic="false"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="flex items-center gap-2 px-4 py-3 bg-surface-container-highest text-on-surface rounded-full shadow-lg elevation-3 animate-in fade-in slide-in-from-bottom-2 duration-300 pointer-events-auto"
            >
              {toast.emoji && (
                <span className="text-lg leading-none" aria-hidden="true">
                  {toast.emoji}
                </span>
              )}
              <span className="text-sm font-medium">{toast.message}</span>
              <button
                onClick={() => dismiss(toast.id)}
                className="ml-1 text-on-surface-variant hover:text-on-surface transition-colors text-xs"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

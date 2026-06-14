"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: number;
  variant: ToastVariant;
  message: string;
  /** Auto-dismiss timeout in ms; 0 means manual dismiss only. */
  ttl: number;
}

interface ToastApi {
  success(message: string, ttl?: number): void;
  error(message: string, ttl?: number): void;
  info(message: string, ttl?: number): void;
  dismiss(id: number): void;
}

const ToastContext = createContext<ToastApi | null>(null);

const MAX_VISIBLE = 3;
const DEFAULT_TTL: Record<ToastVariant, number> = {
  success: 4000,
  info: 7000,
  error: 0, // manual dismiss for errors so the operator can read them
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string, ttl?: number) => {
      const id = ++idRef.current;
      const finalTtl = ttl ?? DEFAULT_TTL[variant];
      setToasts((current) => {
        const next = [...current, { id, variant, message, ttl: finalTtl }];
        // FIFO cap: drop oldest beyond MAX_VISIBLE
        return next.slice(-MAX_VISIBLE);
      });
      if (finalTtl > 0) {
        setTimeout(() => dismiss(id), finalTtl);
      }
    },
    [dismiss],
  );

  const api: ToastApi = {
    success: (m, ttl) => push("success", m, ttl),
    error: (m, ttl) => push("error", m, ttl),
    info: (m, ttl) => push("info", m, ttl),
    dismiss,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <ToastPill key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
      <style jsx global>{`
        @keyframes toast-in {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

function ToastPill({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  // Re-mount focus is handled by the parent container's aria-live; we do not
  // steal focus from the operator's primary keyboard flow.
  useEffect(() => {
    // intentionally empty — TTL is already scheduled by the provider
  }, []);

  const palette: Record<
    ToastVariant,
    { bg: string; text: string; dot: string }
  > = {
    success: {
      bg: "bg-tertiary-container",
      text: "text-on-tertiary-container",
      dot: "bg-tertiary",
    },
    error: {
      bg: "bg-error-container",
      text: "text-on-error-container",
      dot: "bg-error",
    },
    info: {
      bg: "bg-primary-container",
      text: "text-on-primary-container",
      dot: "bg-primary",
    },
  };
  const c = palette[toast.variant];

  return (
    <div
      className={`pointer-events-auto inline-flex items-center gap-3 px-4 py-2.5 rounded-full shadow-lg ${c.bg} ${c.text} max-w-[380px] animate-[toast-in_300ms_cubic-bezier(0.2,0,0,1)]`}
    >
      <span
        className={`w-2 h-2 rounded-full ${c.dot} flex-shrink-0`}
        aria-hidden
      />
      <span className="text-sm leading-tight">{toast.message}</span>
      {toast.variant === "error" && (
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="ml-1 text-on-error-container/70 hover:text-on-error-container text-lg leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}

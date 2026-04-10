"use client";

import { useState, useEffect, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";

const SESSION_KEY = "piq-exit-intent-dismissed";
const TRIGGER_DELAY_MS = 3000; // Don't show until user has been on page 3+ seconds

export function ExitIntentModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [website, setWebsite] = useState("");
  const [ready, setReady] = useState(false);

  // Don't fire until user has spent time on page
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), TRIGGER_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const handleMouseLeave = useCallback((e: MouseEvent) => {
    if (e.clientY > 0) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    setIsOpen(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, [ready, handleMouseLeave]);

  function handleClose() {
    setIsOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (website) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "exit-intent" }),
      });
      if (res.ok) {
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="sm"
      title="Before you go"
      description="Get your free market report — no credit card required."
    >
      {status === "success" ? (
        <div className="text-center py-4">
          <p className="text-emerald-600 font-semibold text-lg mb-2">
            You&apos;re in!
          </p>
          <p className="text-on-surface-variant text-sm">
            Check your inbox for a confirmation link. Your free report is on its
            way.
          </p>
          <button
            onClick={handleClose}
            className="mt-4 px-6 py-2 bg-primary text-on-primary rounded-full font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Honeypot */}
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute opacity-0 h-0 w-0 overflow-hidden pointer-events-none"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            aria-label="Email address"
            className="w-full px-4 py-3 rounded-xl bg-surface border border-outline text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {status === "error" && (
            <p className="text-error text-xs">Something went wrong. Please try again.</p>
          )}
          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full px-6 py-3 bg-primary text-on-primary rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {status === "loading" ? "Sending..." : "Get Free Market Report"}
          </button>
          <p className="text-on-surface-variant text-xs text-center">
            Free. No spam. Unsubscribe anytime.
          </p>
        </form>
      )}
    </Modal>
  );
}

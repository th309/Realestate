"use client";

import { useState } from "react";
import { fetchAPIRaw } from "@/lib/data/fetchers/base";

type ActivationState = "input" | "submitting" | "success" | "error";

export default function ActivatePage() {
  const [code, setCode] = useState("");
  const [state, setState] = useState<ActivationState>("input");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("submitting");
    setErrorMessage("");

    try {
      const res = await fetchAPIRaw("/api/auth/device-code/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_code: code.toUpperCase().trim() }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const errObj = err as { message?: string };
        throw new Error(errObj.message || `Verification failed: ${res.status}`);
      }

      setState("success");
    } catch (err) {
      setState("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Verification failed",
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="w-full max-w-md rounded-xl bg-surface-container p-8 shadow-sm">
        <h1 className="mb-2 text-center font-roboto text-2xl font-medium text-on-surface">
          Connect MCP Server
        </h1>
        <p className="mb-6 text-center text-sm text-on-surface/60">
          Enter the activation code shown in your terminal
        </p>

        {state === "success" ? (
          <div className="rounded-xl bg-primary-container p-6 text-center">
            <p className="text-lg font-medium text-on-surface">Connected!</p>
            <p className="mt-2 text-sm text-on-surface/60">
              Your MCP server is now authenticated. You can close this page.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD-1234"
              maxLength={9}
              className="w-full rounded-xl border border-outline/30 bg-surface px-4 py-3 text-center font-mono text-2xl tracking-widest text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              autoFocus
              disabled={state === "submitting"}
            />

            {state === "error" && (
              <p className="mt-3 text-center text-sm text-error">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={code.length < 9 || state === "submitting"}
              className="mt-4 w-full rounded-full bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {state === "submitting" ? "Verifying..." : "Activate"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

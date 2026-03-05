"use client";

import { useState, useCallback, useRef, useEffect } from "react";

type SubmissionStatus = "idle" | "loading" | "success" | "error";

interface LeadMagnetModalProps {
  metroName: string;
  onClose: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LeadMagnetModal({ metroName, onClose }: LeadMagnetModalProps) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<SubmissionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string;
    email?: string;
  }>({});

  const backdropRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus the first input on mount
  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && status !== "loading") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, status]);

  function validateFields(): boolean {
    const errors: { firstName?: string; email?: string } = {};

    if (!firstName.trim()) {
      errors.firstName = "Please enter your first name.";
    }

    if (!email.trim()) {
      errors.email = "Please enter your email address.";
    } else if (!EMAIL_REGEX.test(email)) {
      errors.email = "Please enter a valid email address.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setErrorMessage("");

      if (!validateFields()) return;

      setStatus("loading");

      try {
        const response = await fetch("/api/lead-magnet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: firstName.trim(),
            email: email.trim().toLowerCase(),
            metroName,
          }),
        });

        if (response.ok) {
          setStatus("success");
        } else {
          const data = await response.json().catch(() => null);
          setErrorMessage(
            data?.error || "Something went wrong. Please try again.",
          );
          setStatus("error");
        }
      } catch {
        setErrorMessage("Network error. Please check your connection.");
        setStatus("error");
      }
    },
    [firstName, email, metroName],
  );

  function handleBackdropClick(event: React.MouseEvent) {
    if (event.target === backdropRef.current && status !== "loading") {
      onClose();
    }
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-magnet-title"
    >
      <div className="bg-surface-container-high rounded-[28px] shadow-lg max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-0 flex items-start justify-between">
          <div>
            <h2
              id="lead-magnet-title"
              className="text-xl font-semibold text-on-surface"
            >
              Free Market Report
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">
              Get a free AI-generated market analysis for {metroName}.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={status === "loading"}
            className="p-2 -mr-2 -mt-1 rounded-full hover:bg-surface-container transition-colors duration-200"
            aria-label="Close dialog"
          >
            <svg
              className="w-5 h-5 text-on-surface-variant"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {status === "success" ? (
          <SuccessContent onClose={onClose} />
        ) : (
          <FormContent
            firstName={firstName}
            email={email}
            status={status}
            errorMessage={errorMessage}
            fieldErrors={fieldErrors}
            firstInputRef={firstInputRef}
            onFirstNameChange={setFirstName}
            onEmailChange={setEmail}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function SuccessContent({ onClose }: { onClose: () => void }) {
  return (
    <div className="px-6 py-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-emerald-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <p className="text-base font-medium text-on-surface">
          You&apos;re all set!
        </p>
      </div>
      <p className="text-sm text-on-surface-variant mb-5">
        We&apos;ll send your free market report shortly. Keep an eye on your
        inbox.
      </p>
      <button
        onClick={onClose}
        className="w-full px-6 py-3 bg-primary text-on-primary rounded-full font-medium text-sm hover:bg-primary/90 transition-colors duration-200"
      >
        Done
      </button>
    </div>
  );
}

interface FormContentProps {
  firstName: string;
  email: string;
  status: SubmissionStatus;
  errorMessage: string;
  fieldErrors: { firstName?: string; email?: string };
  firstInputRef: React.RefObject<HTMLInputElement | null>;
  onFirstNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}

function FormContent({
  firstName,
  email,
  status,
  errorMessage,
  fieldErrors,
  firstInputRef,
  onFirstNameChange,
  onEmailChange,
  onSubmit,
}: FormContentProps) {
  const isLoading = status === "loading";

  return (
    <form onSubmit={onSubmit} className="px-6 pb-6 pt-4">
      {/* First Name */}
      <div className="mb-4">
        <label
          htmlFor="lead-first-name"
          className="block text-sm font-medium text-on-surface mb-1.5"
        >
          First Name
        </label>
        <input
          ref={firstInputRef}
          id="lead-first-name"
          type="text"
          value={firstName}
          onChange={(e) => onFirstNameChange(e.target.value)}
          disabled={isLoading}
          placeholder="Jane"
          className={`w-full px-4 py-3 rounded-xl bg-surface border text-on-surface text-sm
            focus:outline-none focus:ring-2 focus:ring-primary transition-colors duration-200
            disabled:opacity-50 ${
              fieldErrors.firstName
                ? "border-error focus:ring-error"
                : "border-outline"
            }`}
        />
        {fieldErrors.firstName && (
          <p className="text-error text-xs mt-1">{fieldErrors.firstName}</p>
        )}
      </div>

      {/* Email */}
      <div className="mb-5">
        <label
          htmlFor="lead-email"
          className="block text-sm font-medium text-on-surface mb-1.5"
        >
          Email Address
        </label>
        <input
          id="lead-email"
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          disabled={isLoading}
          placeholder="jane@example.com"
          className={`w-full px-4 py-3 rounded-xl bg-surface border text-on-surface text-sm
            focus:outline-none focus:ring-2 focus:ring-primary transition-colors duration-200
            disabled:opacity-50 ${
              fieldErrors.email
                ? "border-error focus:ring-error"
                : "border-outline"
            }`}
        />
        {fieldErrors.email && (
          <p className="text-error text-xs mt-1">{fieldErrors.email}</p>
        )}
      </div>

      {/* Server Error */}
      {errorMessage && (
        <p className="text-error text-sm mb-4">{errorMessage}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full px-6 py-3 bg-primary text-on-primary rounded-full font-medium text-sm
          hover:bg-primary/90 transition-colors duration-200 disabled:opacity-60
          flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <LoadingSpinner />
            Submitting...
          </>
        ) : (
          "Get Free Report"
        )}
      </button>

      <p className="text-xs text-on-surface-variant text-center mt-3">
        No spam, ever. Unsubscribe anytime.
      </p>
    </form>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

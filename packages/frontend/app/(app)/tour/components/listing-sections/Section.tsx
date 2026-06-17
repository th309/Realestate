"use client";

import type { ReactNode } from "react";

interface Props {
  num: string;
  title: string;
  subtitle?: string;
  /**
   * `feature` renders the section as a dark indigo "stage" that echoes the
   * hero masthead — used to give the dossier a premium light/dark rhythm.
   * Content cards passed as children stay light and float on top.
   */
  tone?: "default" | "feature";
  children: ReactNode;
}

export function Section({
  num,
  title,
  subtitle,
  tone = "default",
  children,
}: Props) {
  const feature = tone === "feature";

  const header = (
    <header className="mb-4">
      <span
        className={`mr-2.5 inline-grid h-7 w-7 place-items-center rounded-lg align-middle font-mono text-[13px] font-semibold ${
          feature
            ? "bg-white/15 text-white"
            : "bg-primary-container text-on-primary-container"
        }`}
      >
        {num}
      </span>
      <h2
        className={`inline align-middle text-[22px] font-semibold ${
          feature ? "text-white" : "text-on-surface"
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={`mt-1 pl-9 text-[13px] ${
            feature ? "text-white/70" : "text-on-surface-variant"
          }`}
        >
          {subtitle}
        </p>
      )}
    </header>
  );

  if (!feature) {
    return (
      <section className="border-b border-outline-variant/40 px-5 py-8 md:px-12 md:py-10 last:border-b-0">
        {header}
        {children}
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden border-b border-outline-variant/40 bg-gradient-to-br from-on-primary-container via-primary to-secondary px-5 py-9 text-white md:px-12 md:py-11 last:border-b-0">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className="relative">
        {header}
        {children}
      </div>
    </section>
  );
}

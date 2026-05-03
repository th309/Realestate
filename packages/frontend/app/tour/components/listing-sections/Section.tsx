"use client";

import type { ReactNode } from "react";

interface Props {
  num: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function Section({ num, title, subtitle, children }: Props) {
  return (
    <section className="border-b border-outline-variant/40 px-12 py-10 last:border-b-0">
      <header className="mb-4">
        <span className="mr-2.5 inline-grid h-7 w-7 place-items-center rounded-lg bg-primary-container font-mono text-[13px] font-semibold text-on-primary-container align-middle">
          {num}
        </span>
        <h2 className="inline align-middle text-[22px] font-semibold text-on-surface">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 pl-9 text-[13px] text-on-surface-variant">
            {subtitle}
          </p>
        )}
      </header>
      {children}
    </section>
  );
}

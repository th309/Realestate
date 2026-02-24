import React from 'react';
import Link from 'next/link';

/* ── Section wrapper ─────────────────────────────────────────────── */

interface SectionProps {
  id: string;
  number: number;
  title: string;
  children: React.ReactNode;
}

export function Section({ id, number, title, children }: SectionProps) {
  return (
    <section id={id} className="mb-12 scroll-mt-24">
      <p className="text-xs font-bold tracking-widest uppercase text-tertiary mb-1">
        Section {number}
      </p>
      <h2 className="text-2xl font-medium text-on-surface mb-4 tracking-tight">
        {title}
      </h2>
      <div className="space-y-3.5 text-on-surface-variant leading-relaxed">
        {children}
      </div>
    </section>
  );
}

/* ── Callout box ─────────────────────────────────────────────────── */

interface CalloutProps {
  label: string;
  important?: boolean;
  children: React.ReactNode;
}

export function Callout({ label, important, children }: CalloutProps) {
  return (
    <div
      className={`border-l-4 p-5 rounded-r-lg my-5 ${
        important
          ? 'border-error bg-error-container/30'
          : 'border-tertiary bg-surface-container-low'
      }`}
    >
      <p
        className={`text-xs font-bold tracking-widest uppercase mb-1.5 ${
          important ? 'text-error' : 'text-tertiary'
        }`}
      >
        {label}
      </p>
      <div className="text-sm text-on-surface-variant leading-relaxed">
        {children}
      </div>
    </div>
  );
}

/* ── Contact card ────────────────────────────────────────────────── */

function ContactItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-bold tracking-widest uppercase text-on-surface-variant mb-1">
        {label}
      </p>
      <p className="text-sm text-on-surface font-medium">{children}</p>
    </div>
  );
}

export function ContactCard() {
  return (
    <div className="bg-surface border border-outline-variant rounded-xl p-7 my-5 grid grid-cols-1 md:grid-cols-2 gap-5">
      <ContactItem label="Company">
        Federal Contracting Services LLC
      </ContactItem>
      <ContactItem label="Product">PropertyIQ</ContactItem>
      <ContactItem label="Email">
        <a
          href="mailto:info@propertyiq.app"
          className="text-primary hover:underline"
        >
          info@propertyiq.app
        </a>
      </ContactItem>
      <ContactItem label="Online Contact Form">
        <Link href="/contact" className="text-primary hover:underline">
          propertyiq.app/contact
        </Link>
      </ContactItem>
      <div className="md:col-span-2">
        <ContactItem label="Registered Agent &amp; Mailing Address">
          Republic Registered Agent LLC
          <br />
          20 S Charles St, Ste 403
          <br />
          Baltimore, MD 21201
        </ContactItem>
      </div>
    </div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared shell for the 4 P2 lead-magnet landing pages. The video CTA
 * short link routes here with `?run=<runId>` (and may carry `utm_*`)
 * — the form posts the email + market intent and signup attribution
 * uses the run id to credit the video that drove the conversion.
 *
 * Layout: hero card with magnet name + value prop + bullet strip,
 * form card on the right (or below on mobile), trust footer with
 * social proof.
 */
export function MagnetLandingShell({
  magnetKind,
  eyebrow,
  title,
  subtitle,
  bullets,
  ctaLabel,
  marketQueryPlaceholder,
  coverEmoji,
}: {
  magnetKind: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  bullets: string[];
  ctaLabel: string;
  marketQueryPlaceholder: string;
  coverEmoji: string;
}) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-surface to-primary-container/30">
      <div className="max-w-6xl mx-auto px-6 py-12 md:py-20">
        <header className="mb-12">
          <Link
            href="/"
            className="text-sm font-mono text-on-surface-variant hover:text-on-surface transition-colors duration-200 inline-flex items-center gap-2"
          >
            <span aria-hidden>←</span>
            <span>propertyiq.app</span>
          </Link>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 items-start">
          <Hero
            eyebrow={eyebrow}
            title={title}
            subtitle={subtitle}
            bullets={bullets}
            coverEmoji={coverEmoji}
          />
          <Form
            magnetKind={magnetKind}
            ctaLabel={ctaLabel}
            marketQueryPlaceholder={marketQueryPlaceholder}
          />
        </div>

        <TrustStrip />
      </div>
    </main>
  );
}

function Hero({
  eyebrow,
  title,
  subtitle,
  bullets,
  coverEmoji,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  bullets: string[];
  coverEmoji: string;
}) {
  return (
    <div>
      <p className="text-xs font-mono uppercase tracking-[0.2em] text-primary mb-4">
        {eyebrow}
      </p>
      <h1
        className="text-4xl md:text-5xl font-semibold text-on-surface mb-5 tracking-tight"
        style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}
      >
        {title}
      </h1>
      <p className="text-lg text-on-surface-variant leading-relaxed mb-8 max-w-xl">
        {subtitle}
      </p>
      <div className="rounded-2xl bg-surface-container-low p-6 shadow-sm flex gap-4 max-w-xl">
        <div className="flex-shrink-0 w-16 h-20 rounded-lg bg-primary text-on-primary flex items-center justify-center text-3xl">
          {coverEmoji}
        </div>
        <ul className="space-y-2 text-sm text-on-surface">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-primary flex-shrink-0 mt-0.5" aria-hidden>
                ✓
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Form({
  magnetKind,
  ctaLabel,
  marketQueryPlaceholder,
}: {
  magnetKind: string;
  ctaLabel: string;
  marketQueryPlaceholder: string;
}) {
  return (
    <form
      action="/api/auth/signup"
      method="POST"
      className="bg-surface rounded-2xl p-7 shadow-xl border border-outline-variant"
    >
      <h2 className="text-xl font-semibold text-on-surface mb-1">
        Send it to my inbox
      </h2>
      <p className="text-sm text-on-surface-variant mb-5">
        Free. No credit card. Unsubscribe anytime.
      </p>

      <Field label="Which market?">
        <input
          type="text"
          name="marketQuery"
          placeholder={marketQueryPlaceholder}
          required
          className="w-full rounded-lg border border-outline bg-surface px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
        />
      </Field>

      <Field label="Your email">
        <input
          type="email"
          name="email"
          placeholder="you@brokerage.com"
          required
          className="w-full rounded-lg border border-outline bg-surface px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
        />
      </Field>

      <input type="hidden" name="magnetKind" value={magnetKind} />

      <button
        type="submit"
        className="w-full mt-5 bg-primary text-on-primary rounded-full py-3 font-semibold hover:bg-primary/90 transition-colors duration-200"
      >
        {ctaLabel}
      </button>

      <p className="text-[11px] text-on-surface-variant mt-4 text-center">
        Already a member?{" "}
        <Link href="/login" className="underline text-primary">
          Sign in
        </Link>
      </p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant mb-1.5 block">
        {label}
      </span>
      {children}
    </label>
  );
}

function TrustStrip() {
  return (
    <div className="mt-16 pt-8 border-t border-outline-variant flex flex-wrap gap-x-8 gap-y-3 items-center text-xs text-on-surface-variant">
      <span className="font-mono uppercase tracking-wider">
        Built on data from
      </span>
      <span>Zillow ZHVI</span>
      <span>·</span>
      <span>Redfin</span>
      <span>·</span>
      <span>Census ACS</span>
      <span>·</span>
      <span>BLS</span>
      <span>·</span>
      <span>FRED</span>
    </div>
  );
}

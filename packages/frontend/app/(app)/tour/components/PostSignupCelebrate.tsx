"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTour } from "../TourStateProvider";

export function PostSignupCelebrate() {
  const { session, reset } = useTour();
  const marketShort = session.market?.name?.split(",")[0] ?? "your market";

  // Honor a deep-linked `?next=` (return-to-context) as the primary destination
  // once the tour completes — e.g. /tour?next=/reports sends the user to /reports.
  // Only same-origin relative paths are allowed (no "//" → no open redirect).
  const nextParam = useSearchParams().get("next");
  const safeNext =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : null;
  const primaryHref = safeNext ?? "/dashboard?openReport=latest";

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-on-primary-container to-primary p-9 text-center text-on-primary">
        <div
          className="pointer-events-none absolute -left-12 -top-12 h-48 w-48 rounded-full bg-on-primary/10 blur-2xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-12 -bottom-12 h-48 w-48 rounded-full bg-tertiary/20 blur-2xl"
          aria-hidden="true"
        />

        <div className="relative mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-tertiary text-on-tertiary text-2xl font-bold">
          ✓
        </div>
        <h1 className="relative mt-4 text-[26px] font-semibold leading-tight">
          Your {marketShort} report is saved
        </h1>
        <p className="relative mt-1.5 text-sm text-on-primary/85">
          14-day Pro trial active. No watermark. Branded link ready to share.
        </p>

        <div className="relative mx-auto mt-5 flex max-w-sm items-center gap-3 rounded-xl bg-surface px-4 py-3.5 text-left">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary-container text-lg">
            📄
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-on-surface">
              {session.market?.name ?? marketShort} · Listing Presentation
            </p>
            <p className="text-[11px] text-on-surface-variant">
              Saved to your account just now
            </p>
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap justify-center gap-2.5">
          <Link
            href={primaryHref}
            className="rounded-full bg-tertiary px-5 py-2.5 text-sm font-medium text-on-tertiary"
          >
            {safeNext ? "Continue →" : "Open my report →"}
          </Link>
          <Link
            href="/tour?resume=fresh"
            onClick={reset}
            className="rounded-full border border-on-primary/30 bg-on-primary/10 px-5 py-2.5 text-sm font-medium"
          >
            Try another market
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-on-primary/30 bg-on-primary/10 px-5 py-2.5 text-sm font-medium"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

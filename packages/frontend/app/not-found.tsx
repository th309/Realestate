import Link from "next/link";
import { AppShell } from "@/app/components/AppShell";

/**
 * Global 404. Rendered inside the (now chrome-free) root layout, so it renders
 * the AppShell itself to keep the header/footer that the 404 had before the
 * route-group split. Seeded with `null` — auth state hydrates on the client.
 */
export default function NotFound() {
  return (
    <AppShell initialUserId={null}>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <p className="text-sm font-medium text-primary mb-2">404</p>
        <h1 className="text-2xl font-semibold text-on-surface mb-3">
          This page could not be found
        </h1>
        <p className="text-on-surface-variant mb-8 max-w-md">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90"
        >
          Back to home
        </Link>
      </div>
    </AppShell>
  );
}

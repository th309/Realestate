import { cookies } from "next/headers";
import { AppShell } from "@/app/components/AppShell";

/**
 * Layout for the authenticated application route group.
 *
 * Reads the `piq-uid` cookie to seed `initialUserId` on the first server render
 * — this is the exact read the root layout performed before the route-group
 * split, so authenticated users still render correctly with no auth flash. The
 * cookie read keeps every route in this group dynamic (its previous behavior),
 * which is also what we want: these pages can render user-specific content and
 * must never be statically cached.
 */
export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const initialUserId = cookieStore.get("piq-uid")?.value ?? null;

  return <AppShell initialUserId={initialUserId}>{children}</AppShell>;
}

import { AppShell } from "@/app/components/AppShell";

/**
 * Layout for the public, statically-renderable route group (SEO pages).
 *
 * Crucially it does NOT read cookies, so routes in this group can be statically
 * rendered / ISR-cached. Auth state is hydrated entirely on the client (the
 * `piq-uid` cookie is still readable there), so the only trade-off is a brief
 * header auth flash for the rare logged-in visitor on a cold load — acceptable
 * on pages whose traffic is overwhelmingly anonymous.
 */
export default function PublicGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell initialUserId={null}>{children}</AppShell>;
}

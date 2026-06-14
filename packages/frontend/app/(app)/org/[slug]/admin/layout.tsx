import { redirect } from "next/navigation";
import { OrgContextProvider } from "../../components/OrgContextProvider";
import { OrgGuard } from "../../components/OrgGuard";
import { OrgAdminSidebar } from "../../components/OrgAdminSidebar";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default async function OrgAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Check if this slug has an active redirect (org was renamed).
  // Keep redirect() outside try/catch — it throws a Next.js internal error.
  let redirectSlug: string | null = null;
  try {
    const resolveRes = await fetch(`${API_URL}/api/org/resolve-slug/${slug}`, {
      cache: "no-store",
    });
    if (resolveRes.ok) {
      const data = await resolveRes.json();
      redirectSlug = data.redirect ?? null;
    }
  } catch {
    // 404 or network error = no redirect exists, proceed normally
  }
  if (redirectSlug) {
    redirect(`/org/${redirectSlug}/admin`);
  }

  return (
    <OrgContextProvider slug={slug}>
      <OrgGuard>
        <div className="flex min-h-screen bg-surface">
          <OrgAdminSidebar slug={slug} />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </OrgGuard>
    </OrgContextProvider>
  );
}

import { OrgContextProvider } from "../../components/OrgContextProvider";
import { OrgGuard } from "../../components/OrgGuard";
import { OrgAdminSidebar } from "../../components/OrgAdminSidebar";

export default async function OrgAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

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

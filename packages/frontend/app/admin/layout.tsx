import { AdminCommandSidebar } from './components/AdminCommandSidebar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-surface">
      <AdminCommandSidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

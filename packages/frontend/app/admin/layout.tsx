/**
 * Admin Layout
 *
 * Provides a clean layout for admin pages without the main site header/footer.
 * Admin pages have their own navigation and UI.
 */

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface">
      {children}
    </div>
  );
}

export default async function OrgAdminDashboard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-on-surface">
        Organization Dashboard
      </h1>
      <p className="text-on-surface-variant mt-2">Org: {slug}</p>
    </div>
  );
}

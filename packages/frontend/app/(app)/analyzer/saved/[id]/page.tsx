import SavedClient from "./SavedClient";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SavedClient id={id} />;
}

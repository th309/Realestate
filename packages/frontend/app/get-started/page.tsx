// packages/frontend/app/get-started/page.tsx
import { redirect } from "next/navigation";

export default async function GetStartedRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") qs.set(k, v);
  }
  const target = qs.toString() ? `/tour?${qs}` : "/tour";
  redirect(target);
}

import { redirect } from "next/navigation";

/**
 * /dashboard is deprecated — all auth redirects now go to /map.
 * Permanent redirect so bookmarks and search engines update.
 */
export default function DashboardPage() {
  redirect("/map");
}

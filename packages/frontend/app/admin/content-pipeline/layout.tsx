import type { ReactNode } from "react";
import { ToastProvider } from "./lib/toast";

/**
 * Section layout for /admin/content-pipeline. Mounts the ToastProvider
 * once so every page below can call `useToast()` without each one
 * remounting its own provider (which would silently lose toasts on
 * client-side route transitions).
 */
export default function ContentPipelineLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ToastProvider>{children}</ToastProvider>;
}

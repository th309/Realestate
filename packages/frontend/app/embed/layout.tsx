import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import "../globals.css";
import { EmbedProviders } from "./providers";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PropertyIQ Score Widget",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * Embed Layout
 *
 * Minimal layout for embeddable widgets — no header, footer, sidebar, or nav.
 * Designed to be rendered inside an iframe on third-party sites.
 */
export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${roboto.variable} antialiased bg-transparent`}>
        <EmbedProviders>{children}</EmbedProviders>
      </body>
    </html>
  );
}

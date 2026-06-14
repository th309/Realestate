import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Your Free Account",
  description:
    "Sign up for PropertyIQ and get instant access to AI-powered real estate market scores, maps, and analysis across 925 US metros.",
  alternates: { canonical: "https://www.propertyiq.app/auth/sign-up" },
  openGraph: {
    title: "Create Your Free Account | PropertyIQ",
    description:
      "Sign up for PropertyIQ and get instant access to AI-powered real estate market scores, maps, and analysis across 925 US metros.",
    url: "https://www.propertyiq.app/auth/sign-up",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

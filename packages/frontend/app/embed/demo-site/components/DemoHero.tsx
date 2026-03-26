"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

/**
 * Homepage hero section for the demo brokerage site.
 *
 * Navy background with white text, serif heading, and a CTA that
 * navigates to the Market Data page (preserving the embed token).
 */
export function DemoHero() {
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get("token");
  const querySuffix = tokenParam ? `?token=${tokenParam}` : "";

  return (
    <section
      style={{
        backgroundColor: "#1e3a5f",
        color: "#ffffff",
        padding: "80px 32px",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: 42,
          fontWeight: 700,
          lineHeight: 1.2,
          margin: "0 0 16px",
        }}
      >
        Your Trusted Real Estate Partner in DFW
      </h1>

      <p
        style={{
          fontFamily: "system-ui, sans-serif",
          fontSize: 18,
          lineHeight: 1.6,
          margin: "0 auto 32px",
          maxWidth: 560,
          opacity: 0.85,
        }}
      >
        Market intelligence powered by data, delivered by experts
      </p>

      <Link
        href={`/embed/demo-site/market-data${querySuffix}`}
        style={{
          display: "inline-block",
          backgroundColor: "#ffffff",
          color: "#1e3a5f",
          fontFamily: "system-ui, sans-serif",
          fontSize: 16,
          fontWeight: 600,
          padding: "14px 36px",
          borderRadius: 6,
          textDecoration: "none",
          transition: "background-color 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.backgroundColor = "#f1f5f9";
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.backgroundColor = "#ffffff";
        }}
      >
        View Market Data
      </Link>
    </section>
  );
}

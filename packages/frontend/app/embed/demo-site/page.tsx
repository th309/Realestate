"use client";

import { Suspense } from "react";
import {
  DemoNav,
  DemoHero,
  DemoSection,
  DemoFooter,
  EmbedIframe,
} from "./components";

/**
 * Demo Brokerage Site — Homepage
 *
 * Simulates the homepage of "Acme Real Estate Group", a fictional brokerage
 * that embeds PropertyIQ widgets. Shows metric cards and a score widget
 * for the Dallas-Fort Worth metro area (CBSA 31080).
 */
export default function DemoSiteHomePage() {
  return (
    <Suspense>
      <DemoSiteHomeContent />
    </Suspense>
  );
}

function DemoSiteHomeContent() {
  return (
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      <DemoNav />
      <DemoHero />

      <main style={{ flex: 1 }}>
        {/* Market Snapshot — 3 metric cards side by side */}
        <DemoSection
          title="Market Snapshot"
          subtitle="Real-time metrics for the Dallas-Fort Worth metro area"
          background="gray"
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 24,
            }}
          >
            <EmbedIframe
              embedPath="/embed/metric-card/home_value/metro/31080"
              title="Home Value — Dallas Metro"
              height="200px"
            />
            <EmbedIframe
              embedPath="/embed/metric-card/rent_index/metro/31080"
              title="Rent Index — Dallas Metro"
              height="200px"
            />
            <EmbedIframe
              embedPath="/embed/metric-card/days_on_market/metro/31080"
              title="Days on Market — Dallas Metro"
              height="200px"
            />
          </div>
        </DemoSection>

        {/* Market Health — score widget */}
        <DemoSection
          title="Market Health"
          subtitle="Our proprietary score for the Dallas-Fort Worth market"
        >
          <div
            style={{
              maxWidth: 480,
              margin: "0 auto",
            }}
          >
            <EmbedIframe
              embedPath="/embed/score/metro/31080"
              embedParams={{ scoreType: "propertyiq" }}
              title="Market Health Score — Dallas Metro"
              height="340px"
            />
          </div>
        </DemoSection>
      </main>

      <DemoFooter />
    </div>
  );
}

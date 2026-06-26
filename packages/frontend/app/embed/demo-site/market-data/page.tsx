"use client";

import { Suspense } from "react";
import { DemoNav, DemoSection, DemoFooter, EmbedIframe } from "../components";

/**
 * Demo Brokerage Site — Market Data Page
 *
 * Shows the full interactive PropertyIQ map embed and comparison charts
 * for Dallas, Houston, and Austin metro areas.
 */
export default function DemoSiteMarketDataPage() {
  return (
    <Suspense>
      <DemoSiteMarketDataContent />
    </Suspense>
  );
}

function DemoSiteMarketDataContent() {
  return (
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      <DemoNav />

      <main style={{ flex: 1 }}>
        {/* Interactive map */}
        <DemoSection
          title="Interactive Market Map"
          subtitle="Explore home values, rent trends, and more across the nation"
          background="gray"
        >
          <EmbedIframe
            embedPath="/embed/map-full"
            embedParams={{
              search: "1",
              legend: "1",
              geo_pills: "1",
              metric_picker: "1",
              metric: "home_value",
              geo: "state",
            }}
            title="PropertyIQ Interactive Market Map"
            height="600px"
          />
        </DemoSection>

        {/* Comparison charts — 2 side by side */}
        <DemoSection
          title="Market Trends"
          subtitle="Compare key metrics across Texas metros"
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
              gap: 24,
            }}
          >
            <div>
              <h3
                style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: 18,
                  fontWeight: 600,
                  color: "#1e3a5f",
                  margin: "0 0 12px",
                }}
              >
                Home Values (3 Year)
              </h3>
              <EmbedIframe
                embedPath="/embed/chart"
                embedParams={{
                  metric: "home_value",
                  geo: "metro",
                  ids: "31080,26420",
                  range: "3y",
                  chart_type: "line",
                  show_national: "1",
                }}
                title="Home Value 3Y — Dallas vs Houston"
                height="380px"
              />
            </div>

            <div>
              <h3
                style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: 18,
                  fontWeight: 600,
                  color: "#1e3a5f",
                  margin: "0 0 12px",
                }}
              >
                Rent Trends (5 Year)
              </h3>
              <EmbedIframe
                embedPath="/embed/chart"
                embedParams={{
                  metric: "rent_index",
                  geo: "metro",
                  ids: "31080,26420,12420",
                  range: "5y",
                  chart_type: "line",
                  show_national: "1",
                }}
                title="Rent Trends 5Y — Dallas, Houston, Austin"
                height="380px"
              />
            </div>
          </div>
        </DemoSection>
      </main>

      <DemoFooter />
    </div>
  );
}

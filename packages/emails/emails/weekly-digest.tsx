import { Text, Section, Hr } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

export interface WeeklyDigestProps {
  name: string;
  watchlist: Array<{
    name: string;
    geoType: string;
    geoId: string;
  }>;
  alerts: Array<{
    marketName: string;
    metricId: string;
    condition: string;
    threshold: number;
    currentValue: number;
  }>;
  dashboardUrl: string;
  preferencesUrl: string;
}

export default function WeeklyDigest({
  name,
  watchlist,
  alerts,
  dashboardUrl,
  preferencesUrl,
}: WeeklyDigestProps) {
  return (
    <Layout
      preview={`Your weekly market digest — ${watchlist.length} markets, ${alerts.length} alerts`}
      unsubscribeUrl={preferencesUrl}
    >
      <Text className="text-sm font-medium text-brand m-0 mb-1">
        Weekly Market Digest
      </Text>
      <EmailHeading>Hi {name}, here&apos;s your weekly update</EmailHeading>

      {watchlist.length > 0 && (
        <>
          <Text className="text-base font-semibold text-gray-900 m-0 mt-6 mb-3">
            Your Markets
          </Text>
          {watchlist.map((market, i) => (
            <Section
              key={i}
              className="py-3"
              style={
                i < watchlist.length - 1
                  ? { borderBottom: "1px solid #eee" }
                  : {}
              }
            >
              <Text className="text-sm font-medium text-gray-900 m-0">
                {market.name}
              </Text>
              <Text className="text-xs text-gray-500 m-0 mt-1">
                {market.geoType}
              </Text>
            </Section>
          ))}
        </>
      )}

      {alerts.length > 0 && (
        <>
          <Hr className="border-solid border-gray-200 my-4" />
          <Text className="text-base font-semibold text-gray-900 m-0 mb-3">
            Triggered Alerts (Past 7 Days)
          </Text>
          {alerts.map((alert, i) => (
            <Section
              key={i}
              className="py-3"
              style={
                i < alerts.length - 1 ? { borderBottom: "1px solid #eee" } : {}
              }
            >
              <Text className="text-sm font-medium text-gray-900 m-0">
                {alert.marketName}
              </Text>
              <Text className="text-xs text-gray-500 m-0 mt-1">
                {alert.metricId} {alert.condition} {alert.threshold} — Current:{" "}
                {alert.currentValue}
              </Text>
            </Section>
          ))}
        </>
      )}

      <Section className="text-center mt-8 mb-2">
        <BrandedButton href={dashboardUrl}>View Your Dashboard</BrandedButton>
      </Section>
    </Layout>
  );
}

WeeklyDigest.PreviewProps = {
  name: "Troy",
  watchlist: [
    {
      name: "Austin-Round Rock-Georgetown, TX",
      geoType: "Metro",
      geoId: "12420",
    },
    { name: "Denver-Aurora-Lakewood, CO", geoType: "Metro", geoId: "19740" },
    { name: "78701", geoType: "ZIP", geoId: "78701" },
  ],
  alerts: [
    {
      marketName: "Austin-Round Rock-Georgetown, TX",
      metricId: "home_value",
      condition: "drops below",
      threshold: 400000,
      currentValue: 395200,
    },
  ],
  dashboardUrl: "https://propertyiq.app/dashboard",
  preferencesUrl: "https://propertyiq.app/account/notifications",
} satisfies WeeklyDigestProps;

import { Text, Section, Hr } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

export interface MonthlyDigestProps {
  name: string;
  goal: string;
  priorities: string[];
  budgetRange: string;
  topMarkets: Array<{
    name: string;
    matchScore: number;
    piqScore: number;
    change: number;
  }>;
  watchlistMovers: Array<{
    name: string;
    oldScore: number;
    newScore: number;
    direction: "up" | "down";
  }>;
  marketToWatch: { name: string; reason: string } | null;
  dashboardUrl: string;
  unsubscribeUrl?: string;
}

const GOAL_LABELS: Record<string, string> = {
  first_time_buyer: "buying your first home",
  relocating: "relocating",
  investor_rental: "rental investing",
  investor_flip: "fix & flip investing",
  exploring: "exploring the market",
};

function formatChange(change: number): string {
  if (change > 0) return `+${change}`;
  return String(change);
}

function changeArrow(change: number): string {
  if (change > 0) return "\u2191";
  if (change < 0) return "\u2193";
  return "\u2014";
}

function moverArrow(direction: "up" | "down"): string {
  return direction === "up" ? "\u2191" : "\u2193";
}

function scoreColor(score: number): string {
  if (score >= 80) return "#16a34a";
  if (score >= 60) return "#ca8a04";
  return "#dc2626";
}

export default function MonthlyDigest({
  name,
  goal,
  priorities,
  budgetRange,
  topMarkets,
  watchlistMovers,
  marketToWatch,
  dashboardUrl,
  unsubscribeUrl,
}: MonthlyDigestProps) {
  const goalLabel = GOAL_LABELS[goal] || goal;
  const monthName = new Date().toLocaleString("en-US", { month: "long" });

  return (
    <Layout
      preview={`Your ${monthName} market digest — ${topMarkets.length} top matches`}
      unsubscribeUrl={
        unsubscribeUrl ??
        `${dashboardUrl.replace("/dashboard", "")}/account/notifications`
      }
    >
      <Text className="text-sm font-medium text-brand m-0 mb-1">
        Monthly Market Digest
      </Text>
      <EmailHeading>
        Hey {name}, here&apos;s your {monthName} update
      </EmailHeading>

      <Text className="text-sm text-gray-600 m-0 mb-6 leading-6">
        Based on your profile — {goalLabel} with a budget of {budgetRange},{" "}
        focused on{" "}
        {priorities.length > 0
          ? priorities.slice(0, 3).join(", ")
          : "general market trends"}{" "}
        — here are the markets that match you best right now.
      </Text>

      {topMarkets.length > 0 && (
        <>
          <Text className="text-base font-semibold text-gray-900 m-0 mb-3">
            Your Top Market Matches
          </Text>
          {topMarkets.map((market, i) => (
            <Section
              key={i}
              className="py-3"
              style={
                i < topMarkets.length - 1
                  ? { borderBottom: "1px solid #eee" }
                  : {}
              }
            >
              <Text className="text-sm font-medium text-gray-900 m-0">
                {i + 1}. {market.name}
              </Text>
              <Text className="text-xs text-gray-500 m-0 mt-1">
                Match:{" "}
                <span
                  style={{
                    color: scoreColor(market.matchScore),
                    fontWeight: 600,
                  }}
                >
                  {market.matchScore}
                </span>{" "}
                &bull; PIQ Score:{" "}
                <span
                  style={{
                    color: scoreColor(market.piqScore),
                    fontWeight: 600,
                  }}
                >
                  {market.piqScore}
                </span>
                {market.change !== 0 && (
                  <>
                    {" "}
                    &bull;{" "}
                    <span
                      style={{
                        color: market.change > 0 ? "#16a34a" : "#dc2626",
                      }}
                    >
                      {changeArrow(market.change)} {formatChange(market.change)}{" "}
                      pts
                    </span>
                  </>
                )}
              </Text>
            </Section>
          ))}
        </>
      )}

      {watchlistMovers.length > 0 && (
        <>
          <Hr className="border-solid border-gray-200 my-4" />
          <Text className="text-base font-semibold text-gray-900 m-0 mb-3">
            Watchlist Movers
          </Text>
          <Text className="text-xs text-gray-500 m-0 mb-3">
            Markets on your watchlist with the biggest score changes this month.
          </Text>
          {watchlistMovers.map((mover, i) => (
            <Section
              key={i}
              className="py-2"
              style={
                i < watchlistMovers.length - 1
                  ? { borderBottom: "1px solid #eee" }
                  : {}
              }
            >
              <Text className="text-sm text-gray-900 m-0">
                <span
                  style={{
                    color: mover.direction === "up" ? "#16a34a" : "#dc2626",
                    fontWeight: 600,
                  }}
                >
                  {moverArrow(mover.direction)}
                </span>{" "}
                {mover.name}{" "}
                <span className="text-xs text-gray-500">
                  {mover.oldScore} &rarr; {mover.newScore}
                </span>
              </Text>
            </Section>
          ))}
        </>
      )}

      {marketToWatch && (
        <>
          <Hr className="border-solid border-gray-200 my-4" />
          <Section
            className="p-4 rounded-lg"
            style={{ backgroundColor: "#f5f3ff" }}
          >
            <Text className="text-sm font-semibold text-brand m-0 mb-2">
              Market to Watch
            </Text>
            <Text className="text-sm font-medium text-gray-900 m-0">
              {marketToWatch.name}
            </Text>
            <Text className="text-xs text-gray-600 m-0 mt-1 leading-5">
              {marketToWatch.reason}
            </Text>
          </Section>
        </>
      )}

      <Section className="text-center mt-8 mb-2">
        <BrandedButton href={dashboardUrl}>Explore Your Markets</BrandedButton>
      </Section>

      <Text className="text-xs text-gray-400 text-center m-0 mt-4">
        This digest is personalized based on your quiz answers. Update your
        preferences anytime from your dashboard.
      </Text>

      <Hr className="border-solid border-gray-200 my-4" />
      <Text className="text-xs text-gray-400 text-center m-0">
        Get the weekly update: sign up for the PropertyIQ Market Pulse at{" "}
        <a
          href="https://www.propertyiq.app/newsletter"
          style={{ color: "#6d28d9" }}
        >
          propertyiq.app/newsletter
        </a>
      </Text>
    </Layout>
  );
}

MonthlyDigest.PreviewProps = {
  name: "Troy",
  goal: "investor_rental",
  priorities: ["cash flow", "appreciation", "low vacancy"],
  budgetRange: "$200K – $400K",
  topMarkets: [
    { name: "Memphis, TN-MS-AR", matchScore: 91, piqScore: 78, change: 4 },
    {
      name: "Indianapolis-Carmel-Anderson, IN",
      matchScore: 88,
      piqScore: 82,
      change: -2,
    },
    { name: "Columbus, OH", matchScore: 85, piqScore: 74, change: 0 },
    { name: "Kansas City, MO-KS", matchScore: 83, piqScore: 71, change: 6 },
    { name: "Birmingham-Hoover, AL", matchScore: 80, piqScore: 69, change: -1 },
  ],
  watchlistMovers: [
    {
      name: "Austin-Round Rock-Georgetown, TX",
      oldScore: 64,
      newScore: 71,
      direction: "up",
    },
    {
      name: "Phoenix-Mesa-Chandler, AZ",
      oldScore: 73,
      newScore: 68,
      direction: "down",
    },
  ],
  marketToWatch: {
    name: "Huntsville, AL",
    reason:
      "Job growth surged 3.2% this quarter while home prices remain 22% below the national median. Strong rental demand from the growing aerospace sector makes this a compelling market for cash-flow investors.",
  },
  dashboardUrl: "https://propertyiq.app/dashboard",
} satisfies MonthlyDigestProps;

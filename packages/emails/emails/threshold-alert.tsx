import { Text, Section } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

export interface ThresholdAlertProps {
  name: string;
  marketName: string;
  scoreType: string;
  currentScore: number;
  threshold: number;
  direction: "above" | "below";
  mapUrl: string;
  preferencesUrl: string;
}

const SCORE_TYPE_LABELS: Record<string, string> = {
  propertyiq: "PropertyIQ",
  homeready: "PropertyIQ",
  investoredge: "PropertyIQ",
  market_health: "PropertyIQ",
};

function scoreColor(score: number): string {
  if (score >= 80) return "#16a34a";
  if (score >= 60) return "#ca8a04";
  return "#dc2626";
}

function directionLabel(direction: "above" | "below"): string {
  return direction === "above" ? "rose above" : "dropped below";
}

function directionEmoji(direction: "above" | "below"): string {
  return direction === "above" ? "\u2191" : "\u2193";
}

export default function ThresholdAlert({
  name,
  marketName,
  scoreType,
  currentScore,
  threshold,
  direction,
  mapUrl,
  preferencesUrl,
}: ThresholdAlertProps) {
  const scoreLabel = SCORE_TYPE_LABELS[scoreType] || scoreType;

  return (
    <Layout
      preview={`${marketName} just ${directionLabel(direction)} ${threshold} on ${scoreLabel}`}
      unsubscribeUrl={preferencesUrl}
    >
      <Text className="text-sm font-medium text-brand m-0 mb-1">
        Score Alert
      </Text>
      <EmailHeading>
        Hey {name}, {marketName} just crossed your threshold
      </EmailHeading>

      <Text className="text-sm text-gray-600 m-0 mb-6 leading-6">
        {marketName} {directionLabel(direction)} your{" "}
        <strong>{threshold}</strong> threshold on <strong>{scoreLabel}</strong>.
      </Text>

      <Section
        className="p-4 rounded-lg"
        style={{ backgroundColor: "#f5f3ff" }}
      >
        <Text className="text-xs text-gray-500 m-0 mb-2 uppercase tracking-wide font-medium">
          {scoreLabel} Score
        </Text>
        <Text
          className="text-3xl font-bold m-0 mb-1"
          style={{ color: scoreColor(currentScore) }}
        >
          {directionEmoji(direction)} {currentScore}
        </Text>
        <Text className="text-sm text-gray-600 m-0">
          Threshold: {threshold} &bull; Direction:{" "}
          {direction === "above" ? "crossed above" : "crossed below"}
        </Text>
      </Section>

      <Text className="text-sm text-gray-600 m-0 mt-6 mb-2 leading-6">
        This alert was triggered because the current score ({currentScore})
        {direction === "above" ? " exceeded " : " fell below "}
        your configured threshold of {threshold}.
      </Text>

      <Section className="text-center mt-8 mb-2">
        <BrandedButton href={mapUrl}>View on Map &rarr;</BrandedButton>
      </Section>

      <Text className="text-xs text-gray-400 text-center m-0 mt-4">
        You&apos;re receiving this because you set a score alert for{" "}
        {marketName}. Manage your alerts anytime from your dashboard.
      </Text>
    </Layout>
  );
}

ThresholdAlert.PreviewProps = {
  name: "Troy",
  marketName: "Austin-Round Rock-Georgetown, TX",
  scoreType: "homeready",
  currentScore: 78,
  threshold: 75,
  direction: "above",
  mapUrl: "https://propertyiq.app/map?geo=metro&id=12420",
  preferencesUrl: "https://propertyiq.app/account/notifications",
} satisfies ThresholdAlertProps;

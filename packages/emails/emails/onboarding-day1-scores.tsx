import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

export interface OnboardingDay1ScoresProps {
  name: string;
  loginUrl: string;
}

export default function OnboardingDay1Scores({
  name,
  loginUrl,
}: OnboardingDay1ScoresProps) {
  const mapUrl = `${loginUrl}/map`;

  return (
    <Layout preview="How to read your PropertyIQ scores">
      <EmailHeading>How to Read Your Scores</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Hey {name},
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Every market on PropertyIQ gets three scores. Here&apos;s what each one
        tells you:
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-2">
        <strong>HomeReady (0-100)</strong> — Predicts 3-year price appreciation.
        Best for homebuyers looking for markets where values are likely to grow.
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-2">
        <strong>InvestorEdge (0-100)</strong> — Predicts total return
        (appreciation + rental yield). Best for investors who want the full
        picture on cash flow and growth.
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        <strong>Market Health (0-100)</strong> — Current market conditions.
        Tells you how hot (or cold) a market is right now based on supply,
        demand, and pricing trends.
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-6">
        Higher is better across the board. Pick a market on the map and see all
        three scores side by side:
      </Text>
      <Section className="text-center mb-6">
        <BrandedButton href={mapUrl}>See Scores on the Map</BrandedButton>
      </Section>
      <Text className="text-sm text-gray-500 leading-5 m-0">
        If the button doesn&apos;t work, copy this link:{" "}
        <Link href={mapUrl} className="text-brand underline">
          {mapUrl}
        </Link>
      </Text>
    </Layout>
  );
}

OnboardingDay1Scores.PreviewProps = {
  name: "Troy",
  loginUrl: "https://propertyiq.app",
} satisfies OnboardingDay1ScoresProps;

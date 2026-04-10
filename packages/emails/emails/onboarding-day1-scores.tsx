import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

export interface OnboardingDay1ScoresProps {
  name: string;
  loginUrl: string;
  unsubscribeUrl?: string;
}

export default function OnboardingDay1Scores({
  name,
  loginUrl,
  unsubscribeUrl,
}: OnboardingDay1ScoresProps) {
  const mapUrl = `${loginUrl}/map`;

  return (
    <Layout preview="What does a 74 actually mean?" unsubscribeUrl={unsubscribeUrl}>
      <EmailHeading>How to Read Your Scores</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Hey {name},
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Every market on PropertyIQ gets a{" "}
        <strong>PropertyIQ Score (1-99)</strong> that predicts which markets
        will outperform. Here&apos;s how to read it:
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-2">
        <strong>Score 50 = state average.</strong> Higher means the market is
        predicted to outperform its state; lower means underperformance.
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-2">
        The score is built from 3 demand-signal metrics: % Sold Above List
        Price, Median Days on Market, and Months of Supply — validated across 13
        years with a 100% year hit rate.
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Markets scoring 80+ have historically gained{" "}
        <strong>$18,100 more</strong> on a typical home over 3 years compared to
        bottom-scoring markets.
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-6">
        Pick a market on the map and see your PropertyIQ Score:
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

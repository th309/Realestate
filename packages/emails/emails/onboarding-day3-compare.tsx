import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

export interface OnboardingDay3CompareProps {
  name: string;
  loginUrl: string;
  unsubscribeUrl?: string;
}

export default function OnboardingDay3Compare({
  name,
  loginUrl,
  unsubscribeUrl,
}: OnboardingDay3CompareProps) {
  const mapUrl = `${loginUrl}/map`;
  const pricingUrl = `${loginUrl}/pricing?from=email_day3`;

  return (
    <Layout
      preview="Here's how investors are using PropertyIQ to find their next market"
      unsubscribeUrl={unsubscribeUrl}
    >
      <EmailHeading>How Investors Use PropertyIQ</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Hey {name},
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Here&apos;s how a typical PropertyIQ session goes for an investor
        looking for their next market:
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-2">
        <strong>Step 1:</strong> Open the map and filter by PropertyIQ Score
        &gt; 70. This removes markets with weak fundamentals immediately.
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-2">
        <strong>Step 2:</strong> Sort by rent-to-price ratio or score momentum
        to surface markets gaining ground fast.
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-5">
        <strong>Step 3:</strong> Drop 2–3 finalists into the comparison view.
        Side-by-side metrics, trends, and demographics. Pick the one.
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-6">
        The whole process takes about 10 minutes. Give it a try:
      </Text>
      <Section className="text-center mb-5">
        <BrandedButton href={mapUrl}>Find Your Next Market</BrandedButton>
      </Section>
      <Section className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <Text className="text-sm font-semibold text-blue-900 leading-5 m-0 mb-1">
          Want unlimited access?
        </Text>
        <Text className="text-sm text-blue-700 leading-5 m-0 mb-3">
          Pro users get 40+ metrics per market, AI-powered reports, and no
          5-market cap — everything you need to vet a deal fast.
        </Text>
        <Link
          href={pricingUrl}
          className="text-sm font-semibold text-blue-700 underline"
        >
          See Pro plans →
        </Link>
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

OnboardingDay3Compare.PreviewProps = {
  name: "Troy",
  loginUrl: "https://propertyiq.app",
} satisfies OnboardingDay3CompareProps;

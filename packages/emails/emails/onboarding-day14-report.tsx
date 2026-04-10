import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

export interface OnboardingDay14ReportProps {
  name: string;
  loginUrl: string;
  unsubscribeUrl?: string;
}

export default function OnboardingDay14Report({
  name,
  loginUrl,
  unsubscribeUrl,
}: OnboardingDay14ReportProps) {
  const mapUrl = `${loginUrl}/map`;
  const pricingUrl = `${loginUrl}/pricing?from=email_day14`;

  return (
    <Layout
      preview="One thing before you go"
      unsubscribeUrl={unsubscribeUrl}
    >
      <EmailHeading>One Thing Before You Go</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Hey {name},
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        You&apos;ve had two weeks of PropertyIQ. Here&apos;s where things stand:
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-2">
        Your free account gives you access to scores across 400+ markets, the
        interactive map, and Quinn — our AI analyst — forever. No credit card,
        no expiration.
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-5">
        If you&apos;ve been curious about what&apos;s behind the scores — the
        40+ data metrics, AI-generated market reports, score breakdowns, and
        unlimited market comparisons — that&apos;s Pro.
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-6">
        One number per market is powerful. The full picture is how investors
        make the call with confidence.
      </Text>
      <Section className="text-center mb-5">
        <BrandedButton href={pricingUrl}>Explore Pro</BrandedButton>
      </Section>
      <Text className="text-sm text-gray-500 leading-5 m-0 mb-3">
        Not ready? No problem —{" "}
        <Link href={mapUrl} className="text-brand underline">
          your free access
        </Link>{" "}
        is always here.
      </Text>
      <Text className="text-sm text-gray-500 leading-5 m-0">
        If the button doesn&apos;t work, copy this link:{" "}
        <Link href={pricingUrl} className="text-brand underline">
          {pricingUrl}
        </Link>
      </Text>
    </Layout>
  );
}

OnboardingDay14Report.PreviewProps = {
  name: "Troy",
  loginUrl: "https://propertyiq.app",
} satisfies OnboardingDay14ReportProps;

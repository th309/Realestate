import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

export interface OnboardingDay7ProfileProps {
  name: string;
  loginUrl: string;
  unsubscribeUrl?: string;
}

export default function OnboardingDay7Profile({
  name,
  loginUrl,
  unsubscribeUrl,
}: OnboardingDay7ProfileProps) {
  const onboardingUrl = `${loginUrl}/onboarding`;

  const pricingUrl = `${loginUrl}/pricing?from=email_day7`;

  return (
    <Layout
      preview="What Pro users see that free users miss"
      unsubscribeUrl={unsubscribeUrl}
    >
      <EmailHeading>Ready to Go Further?</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Hey {name},
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        You&apos;ve had a week to explore PropertyIQ. Here&apos;s what free
        users can&apos;t see yet:
      </Text>
      <Section className="mb-5">
        <Text className="text-sm text-gray-700 leading-5 m-0 mb-2">
          🔒 <strong>Score breakdowns</strong> — understand exactly why a market
          ranks the way it does
        </Text>
        <Text className="text-sm text-gray-700 leading-5 m-0 mb-2">
          🔒 <strong>40+ data metrics</strong> — median DOM, price cuts, rent
          yield, cap rate, and more
        </Text>
        <Text className="text-sm text-gray-700 leading-5 m-0 mb-2">
          🔒 <strong>AI market reports</strong> — plain-English summaries ready
          to share with partners or agents
        </Text>
        <Text className="text-sm text-gray-700 leading-5 m-0">
          🔒 <strong>Unlimited markets</strong> — no 5-market cap
        </Text>
      </Section>
      <Section className="text-center mb-5">
        <BrandedButton href={pricingUrl}>Unlock Pro Access</BrandedButton>
      </Section>
      <Text className="text-sm text-gray-500 leading-5 m-0 mb-4">
        Or, if you haven&apos;t set up your preferences yet, take 60 seconds to
        tell us your goals and we&apos;ll surface markets matched to you:{" "}
        <Link href={onboardingUrl} className="text-brand underline">
          Complete your profile
        </Link>
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

OnboardingDay7Profile.PreviewProps = {
  name: "Troy",
  loginUrl: "https://propertyiq.app",
} satisfies OnboardingDay7ProfileProps;

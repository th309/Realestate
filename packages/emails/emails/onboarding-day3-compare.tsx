import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";
import { ONBOARDING_DAY3, BUTTON_FALLBACK_PREFIX } from "../copy/email-copy";

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
    <Layout preview={ONBOARDING_DAY3.preview} unsubscribeUrl={unsubscribeUrl}>
      <EmailHeading>{ONBOARDING_DAY3.heading}</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        {ONBOARDING_DAY3.greeting(name)}
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        {ONBOARDING_DAY3.intro}
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-2">
        <strong>{ONBOARDING_DAY3.step1Label}</strong>
        {ONBOARDING_DAY3.step1Body}
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-2">
        <strong>{ONBOARDING_DAY3.step2Label}</strong>
        {ONBOARDING_DAY3.step2Body}
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-5">
        <strong>{ONBOARDING_DAY3.step3Label}</strong>
        {ONBOARDING_DAY3.step3Body}
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-6">
        {ONBOARDING_DAY3.closing}
      </Text>
      <Section className="text-center mb-5">
        <BrandedButton href={mapUrl}>{ONBOARDING_DAY3.cta}</BrandedButton>
      </Section>
      <Section className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <Text className="text-sm font-semibold text-blue-900 leading-5 m-0 mb-1">
          {ONBOARDING_DAY3.upsellHeading}
        </Text>
        <Text className="text-sm text-blue-700 leading-5 m-0 mb-3">
          {ONBOARDING_DAY3.upsellBody}
        </Text>
        <Link
          href={pricingUrl}
          className="text-sm font-semibold text-blue-700 underline"
        >
          {ONBOARDING_DAY3.upsellLink}
        </Link>
      </Section>
      <Text className="text-sm text-gray-500 leading-5 m-0">
        {BUTTON_FALLBACK_PREFIX}{" "}
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

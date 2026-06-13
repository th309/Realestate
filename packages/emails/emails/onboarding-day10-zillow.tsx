import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";
import { ONBOARDING_DAY10, BUTTON_FALLBACK_PREFIX } from "../copy/email-copy";

export interface OnboardingDay10ZillowProps {
  name: string;
  loginUrl: string;
  unsubscribeUrl?: string;
}

export default function OnboardingDay10Zillow({
  name,
  loginUrl,
  unsubscribeUrl,
}: OnboardingDay10ZillowProps) {
  const mapUrl = `${loginUrl}/map`;

  return (
    <Layout preview={ONBOARDING_DAY10.preview} unsubscribeUrl={unsubscribeUrl}>
      <EmailHeading>{ONBOARDING_DAY10.heading}</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        {ONBOARDING_DAY10.greeting(name)}
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        {ONBOARDING_DAY10.body1}
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-2">
        <strong>{ONBOARDING_DAY10.zillowLabel}</strong>
        {ONBOARDING_DAY10.zillowBody}
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-5">
        <strong>{ONBOARDING_DAY10.propertyiqLabel}</strong>
        {ONBOARDING_DAY10.propertyiqBody}
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        {ONBOARDING_DAY10.body2}
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-6">
        {ONBOARDING_DAY10.closing}
      </Text>
      <Section className="text-center mb-5">
        <BrandedButton href={mapUrl}>{ONBOARDING_DAY10.cta}</BrandedButton>
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

OnboardingDay10Zillow.PreviewProps = {
  name: "Troy",
  loginUrl: "https://propertyiq.app",
} satisfies OnboardingDay10ZillowProps;

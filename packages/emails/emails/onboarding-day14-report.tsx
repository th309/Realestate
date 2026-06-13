import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";
import { ONBOARDING_DAY14, BUTTON_FALLBACK_PREFIX } from "../copy/email-copy";

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
    <Layout preview={ONBOARDING_DAY14.preview} unsubscribeUrl={unsubscribeUrl}>
      <EmailHeading>{ONBOARDING_DAY14.heading}</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        {ONBOARDING_DAY14.greeting(name)}
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        {ONBOARDING_DAY14.intro}
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-2">
        {ONBOARDING_DAY14.body1}
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-5">
        {ONBOARDING_DAY14.body2}
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-6">
        {ONBOARDING_DAY14.closing}
      </Text>
      <Section className="text-center mb-5">
        <BrandedButton href={pricingUrl}>{ONBOARDING_DAY14.cta}</BrandedButton>
      </Section>
      <Text className="text-sm text-gray-500 leading-5 m-0 mb-3">
        {ONBOARDING_DAY14.fallbackLeadIn}{" "}
        <Link href={mapUrl} className="text-brand underline">
          {ONBOARDING_DAY14.fallbackLink}
        </Link>
        {ONBOARDING_DAY14.fallbackTail}
      </Text>
      <Text className="text-sm text-gray-500 leading-5 m-0">
        {BUTTON_FALLBACK_PREFIX}{" "}
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

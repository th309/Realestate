import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";
import { ONBOARDING_DAY7, BUTTON_FALLBACK_PREFIX } from "../copy/email-copy";

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
    <Layout preview={ONBOARDING_DAY7.preview} unsubscribeUrl={unsubscribeUrl}>
      <EmailHeading>{ONBOARDING_DAY7.heading}</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        {ONBOARDING_DAY7.greeting(name)}
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        {ONBOARDING_DAY7.intro}
      </Text>
      <Section className="mb-5">
        {ONBOARDING_DAY7.benefits.map((benefit, index) => (
          <Text
            key={benefit.label}
            className={
              index === ONBOARDING_DAY7.benefits.length - 1
                ? "text-sm text-gray-700 leading-5 m-0"
                : "text-sm text-gray-700 leading-5 m-0 mb-2"
            }
          >
            🔒 <strong>{benefit.label}</strong>
            {benefit.body}
          </Text>
        ))}
      </Section>
      <Section className="text-center mb-5">
        <BrandedButton href={pricingUrl}>{ONBOARDING_DAY7.cta}</BrandedButton>
      </Section>
      <Text className="text-sm text-gray-500 leading-5 m-0 mb-4">
        {ONBOARDING_DAY7.profilePrompt}{" "}
        <Link href={onboardingUrl} className="text-brand underline">
          {ONBOARDING_DAY7.profileLink}
        </Link>
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

OnboardingDay7Profile.PreviewProps = {
  name: "Troy",
  loginUrl: "https://propertyiq.app",
} satisfies OnboardingDay7ProfileProps;

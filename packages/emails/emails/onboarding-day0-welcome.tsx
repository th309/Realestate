import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";
import { ONBOARDING_DAY0, BUTTON_FALLBACK_PREFIX } from "../copy/email-copy";

export interface OnboardingDay0WelcomeProps {
  name: string;
  loginUrl: string;
  unsubscribeUrl?: string;
}

export default function OnboardingDay0Welcome({
  name,
  loginUrl,
  unsubscribeUrl,
}: OnboardingDay0WelcomeProps) {
  const mapUrl = `${loginUrl}/map`;

  return (
    <Layout
      preview={ONBOARDING_DAY0.preview(name)}
      unsubscribeUrl={unsubscribeUrl}
    >
      <EmailHeading>{ONBOARDING_DAY0.heading}</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        {ONBOARDING_DAY0.greeting(name)}
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-6">
        {ONBOARDING_DAY0.body}
      </Text>
      <Section className="text-center mb-6">
        <BrandedButton href={mapUrl}>{ONBOARDING_DAY0.cta}</BrandedButton>
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

OnboardingDay0Welcome.PreviewProps = {
  name: "Troy",
  loginUrl: "https://propertyiq.app",
} satisfies OnboardingDay0WelcomeProps;

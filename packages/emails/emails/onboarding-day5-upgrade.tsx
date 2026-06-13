import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";
import { ONBOARDING_DAY5, BUTTON_FALLBACK_PREFIX } from "../copy/email-copy";

export interface OnboardingDay5UpgradeProps {
  name: string;
  loginUrl: string;
  unsubscribeUrl?: string;
}

// NOTE: The CMO updates the market list and score data in this email monthly.
// When updated copy arrives, edit the market names, scores, and score changes below.
export default function OnboardingDay5Upgrade({
  name,
  loginUrl,
  unsubscribeUrl,
}: OnboardingDay5UpgradeProps) {
  const mapUrl = `${loginUrl}/map`;

  return (
    <Layout preview={ONBOARDING_DAY5.preview} unsubscribeUrl={unsubscribeUrl}>
      <EmailHeading>{ONBOARDING_DAY5.heading}</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        {ONBOARDING_DAY5.greeting(name)}
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-5">
        {ONBOARDING_DAY5.body}
      </Text>
      <Section className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <Text className="text-sm font-semibold text-gray-900 leading-5 m-0 mb-3">
          {ONBOARDING_DAY5.moversHeading}
        </Text>
        <Text className="text-sm text-gray-700 leading-5 m-0 mb-1">
          🔼 <strong>{ONBOARDING_DAY5.moversLeadIn}</strong>
          {ONBOARDING_DAY5.moversBody}
        </Text>
        <Text className="text-sm text-gray-500 leading-5 m-0 mt-3">
          <Link href={mapUrl} className="text-brand underline">
            {ONBOARDING_DAY5.moversLink}
          </Link>
        </Text>
      </Section>
      <Section className="text-center mb-5">
        <BrandedButton href={mapUrl}>{ONBOARDING_DAY5.cta}</BrandedButton>
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

OnboardingDay5Upgrade.PreviewProps = {
  name: "Troy",
  loginUrl: "https://propertyiq.app",
} satisfies OnboardingDay5UpgradeProps;

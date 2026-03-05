import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

export interface OnboardingDay7ProfileProps {
  name: string;
  loginUrl: string;
}

export default function OnboardingDay7Profile({
  name,
  loginUrl,
}: OnboardingDay7ProfileProps) {
  const onboardingUrl = `${loginUrl}/onboarding`;

  return (
    <Layout preview="Get recommendations tailored to you">
      <EmailHeading>Get Personalized Recommendations</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Hey {name},
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        PropertyIQ can recommend markets that match your goals — but first, we
        need to know a little about what you&apos;re looking for. Are you buying
        a home? Investing for cash flow? Looking for long-term appreciation?
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-6">
        Complete a quick profile (takes about 60 seconds) and we&apos;ll start
        surfacing markets tailored to you:
      </Text>
      <Section className="text-center mb-6">
        <BrandedButton href={onboardingUrl}>
          Complete Your Profile
        </BrandedButton>
      </Section>
      <Text className="text-sm text-gray-500 leading-5 m-0">
        If the button doesn&apos;t work, copy this link:{" "}
        <Link href={onboardingUrl} className="text-brand underline">
          {onboardingUrl}
        </Link>
      </Text>
    </Layout>
  );
}

OnboardingDay7Profile.PreviewProps = {
  name: "Troy",
  loginUrl: "https://propertyiq.app",
} satisfies OnboardingDay7ProfileProps;

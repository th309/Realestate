import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

export interface OnboardingDay0WelcomeProps {
  name: string;
  loginUrl: string;
}

export default function OnboardingDay0Welcome({
  name,
  loginUrl,
}: OnboardingDay0WelcomeProps) {
  const mapUrl = `${loginUrl}/map`;

  return (
    <Layout preview={`Welcome to PropertyIQ, ${name}!`}>
      <EmailHeading>Welcome to PropertyIQ</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Hey {name},
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        We&apos;re excited to have you here. PropertyIQ helps you find the best
        real estate markets using data-driven scores, analytics, and AI-powered
        reports — so you can make smarter decisions whether you&apos;re buying
        your first home or building a portfolio.
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-6">
        The best place to start? The interactive map. Pick any market and see
        how it scores:
      </Text>
      <Section className="text-center mb-6">
        <BrandedButton href={mapUrl}>Explore the Map</BrandedButton>
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

OnboardingDay0Welcome.PreviewProps = {
  name: "Troy",
  loginUrl: "https://propertyiq.app",
} satisfies OnboardingDay0WelcomeProps;

import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

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
      preview={`Your free PropertyIQ Score is ready, ${name}`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <EmailHeading>Your Free PropertyIQ Score Is Ready</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Hey {name},
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-6">
        Welcome. Here&apos;s how to get your first market score in 60 seconds:
        open the map, search for any U.S. city or ZIP code, and click it.
        You&apos;ll see a 0–100 PropertyIQ Score that captures supply, demand,
        affordability, rent growth, and economic momentum — all in one number.
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

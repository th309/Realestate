import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

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
    <Layout
      preview="PropertyIQ does market-level scoring. Zillow does property listings. Different tools."
      unsubscribeUrl={unsubscribeUrl}
    >
      <EmailHeading>&ldquo;I already use Zillow for this.&rdquo;</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Hey {name},
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        We hear this a lot. Zillow is great — for what it does.
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-2">
        <strong>Zillow answers:</strong> What is this property worth?
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-5">
        <strong>PropertyIQ answers:</strong> Which markets should I be in?
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Zillow works at the property level — individual listings, Zestimates,
        days on market for a single home. PropertyIQ works at the market level
        — scoring every metro, county, and ZIP on supply, demand,
        affordability, rent growth, and economic momentum. Updated monthly.
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-6">
        Use Zillow to pick the property. Use PropertyIQ to pick the market.
      </Text>
      <Section className="text-center mb-5">
        <BrandedButton href={mapUrl}>See Your Market Scores</BrandedButton>
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

OnboardingDay10Zillow.PreviewProps = {
  name: "Troy",
  loginUrl: "https://propertyiq.app",
} satisfies OnboardingDay10ZillowProps;

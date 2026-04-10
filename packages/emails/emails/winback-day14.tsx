import { Text, Section, Hr } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

export interface WinbackDay14Props {
  name: string;
  loginUrl: string;
}

export default function WinbackDay14({ name, loginUrl }: WinbackDay14Props) {
  const mapUrl = `${loginUrl}/map`;
  const marketsUrl = `${loginUrl}/markets`;

  return (
    <Layout preview="Markets have moved since you last checked in">
      <EmailHeading>Markets have moved since you last checked in</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Hey {name},
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        A lot can change in two weeks. PropertyIQ scores are updated monthly
        from Zillow, Census, and Realtor.com data — and some of the markets you
        were watching may have shifted.
      </Text>

      <Hr className="border-gray-200 my-5" />

      <Text className="text-sm font-semibold text-gray-900 m-0 mb-2">
        What&apos;s new since you left:
      </Text>
      <Text className="text-sm text-gray-600 leading-5 m-0 mb-1">
        📈 &nbsp;Monthly score updates across 400+ metros, 2,000+ counties, and
        20,000+ ZIP codes
      </Text>
      <Text className="text-sm text-gray-600 leading-5 m-0 mb-1">
        🗺️ &nbsp;Interactive map with heat-mapped PropertyIQ scores
      </Text>
      <Text className="text-sm text-gray-600 leading-5 m-0 mb-5">
        🤖 &nbsp;Quinn AI can answer market questions in plain English
      </Text>

      <Hr className="border-gray-200 my-5" />

      <Section className="text-center mb-5">
        <BrandedButton href={mapUrl}>See What&apos;s Changed</BrandedButton>
      </Section>

      <Text className="text-sm text-gray-500 leading-5 m-0">
        Or browse all markets at{" "}
        <a href={marketsUrl} className="text-brand underline">
          propertyiq.app/markets
        </a>
        .
      </Text>
    </Layout>
  );
}

WinbackDay14.PreviewProps = {
  name: "Troy",
  loginUrl: "https://propertyiq.app",
} satisfies WinbackDay14Props;

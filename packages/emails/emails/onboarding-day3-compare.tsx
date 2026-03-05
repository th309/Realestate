import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

export interface OnboardingDay3CompareProps {
  name: string;
  loginUrl: string;
}

export default function OnboardingDay3Compare({
  name,
  loginUrl,
}: OnboardingDay3CompareProps) {
  const graphsUrl = `${loginUrl}/graphs`;

  return (
    <Layout preview="Did you know you can compare markets?">
      <EmailHeading>Compare Markets Side by Side</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Hey {name},
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Narrowing down between a few markets? PropertyIQ lets you compare 2-3
        markets side by side — scores, trends, demographics, and more — so you
        can see exactly how they stack up against each other.
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-6">
        It&apos;s the fastest way to go from &quot;I&apos;m interested in a few
        places&quot; to &quot;this is the one.&quot;
      </Text>
      <Section className="text-center mb-6">
        <BrandedButton href={graphsUrl}>Compare Markets</BrandedButton>
      </Section>
      <Text className="text-sm text-gray-500 leading-5 m-0">
        If the button doesn&apos;t work, copy this link:{" "}
        <Link href={graphsUrl} className="text-brand underline">
          {graphsUrl}
        </Link>
      </Text>
    </Layout>
  );
}

OnboardingDay3Compare.PreviewProps = {
  name: "Troy",
  loginUrl: "https://propertyiq.app",
} satisfies OnboardingDay3CompareProps;

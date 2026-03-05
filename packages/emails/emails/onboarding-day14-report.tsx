import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

export interface OnboardingDay14ReportProps {
  name: string;
  loginUrl: string;
}

export default function OnboardingDay14Report({
  name,
  loginUrl,
}: OnboardingDay14ReportProps) {
  const reportsUrl = `${loginUrl}/reports`;

  return (
    <Layout preview="Your first market report is on us">
      <EmailHeading>Your First Market Report Is on Us</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Hey {name},
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Ready to go deeper on a market? PropertyIQ can generate an AI-powered
        report for any market — covering scores, trends, demographics, risk
        factors, and a plain-English summary of what it all means.
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-6">
        Reports are easy to share with partners, agents, or family. Pick a
        market and generate your first one — it&apos;s free:
      </Text>
      <Section className="text-center mb-6">
        <BrandedButton href={reportsUrl}>Generate a Free Report</BrandedButton>
      </Section>
      <Text className="text-sm text-gray-500 leading-5 m-0">
        If the button doesn&apos;t work, copy this link:{" "}
        <Link href={reportsUrl} className="text-brand underline">
          {reportsUrl}
        </Link>
      </Text>
    </Layout>
  );
}

OnboardingDay14Report.PreviewProps = {
  name: "Troy",
  loginUrl: "https://propertyiq.app",
} satisfies OnboardingDay14ReportProps;

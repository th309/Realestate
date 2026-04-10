import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

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
    <Layout
      preview="The 5 markets that moved the most this month"
      unsubscribeUrl={unsubscribeUrl}
    >
      <EmailHeading>The 5 Markets That Moved the Most This Month</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Hey {name},
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-5">
        PropertyIQ scores update monthly. Here are the markets that saw the
        biggest score movement this month — markets gaining ground fast are
        worth watching before the rest of the market catches on.
      </Text>
      <Section className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <Text className="text-sm font-semibold text-gray-900 leading-5 m-0 mb-3">
          Top movers this month
        </Text>
        <Text className="text-sm text-gray-700 leading-5 m-0 mb-1">
          🔼 <strong>Check the platform</strong> for this month&apos;s live
          rankings — scores update each month and the top movers change.
        </Text>
        <Text className="text-sm text-gray-500 leading-5 m-0 mt-3">
          <Link href={mapUrl} className="text-brand underline">
            See current rankings →
          </Link>
        </Text>
      </Section>
      <Section className="text-center mb-5">
        <BrandedButton href={mapUrl}>View Live Market Scores</BrandedButton>
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

OnboardingDay5Upgrade.PreviewProps = {
  name: "Troy",
  loginUrl: "https://propertyiq.app",
} satisfies OnboardingDay5UpgradeProps;

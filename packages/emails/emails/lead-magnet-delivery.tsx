import { Text, Section, Link } from "@react-email/components";
import * as React from "react";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

export interface LeadMagnetDeliveryProps {
  userName: string;
  magnetDisplayName: string;
  marketName: string;
  dashboardUrl: string;
}

export const LeadMagnetDelivery: React.FC<LeadMagnetDeliveryProps> = ({
  userName,
  magnetDisplayName,
  marketName,
  dashboardUrl,
}) => (
  <Layout preview={`Your ${magnetDisplayName} for ${marketName} is ready.`}>
    <EmailHeading>
      Your {magnetDisplayName} for {marketName} is ready, {userName}.
    </EmailHeading>
    <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
      Attached is your personalized PropertyIQ report. We pulled the latest
      market data this morning; you can see the underlying numbers, forecasts,
      and comparable markets on your dashboard.
    </Text>
    <Section className="text-center my-8">
      <BrandedButton href={dashboardUrl}>View on Dashboard</BrandedButton>
    </Section>
    <Text className="text-sm text-gray-500 leading-5 m-0">
      Refresh this report anytime at{" "}
      <Link href={dashboardUrl} className="text-brand underline">
        propertyiq.app
      </Link>
      .
    </Text>
  </Layout>
);

LeadMagnetDelivery.displayName = "LeadMagnetDelivery";

export default LeadMagnetDelivery;

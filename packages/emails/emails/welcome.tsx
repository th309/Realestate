import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

export interface WelcomeEmailProps {
  name: string;
  loginUrl: string;
}

export default function WelcomeEmail({ name, loginUrl }: WelcomeEmailProps) {
  return (
    <Layout preview={`Welcome to PropertyIQ, ${name}!`}>
      <EmailHeading>Welcome to PropertyIQ</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Hi {name},
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Thanks for signing up! PropertyIQ gives you real estate market
        analytics, scoring, and insights — all in one place.
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-6">
        Jump in and explore your first market:
      </Text>
      <Section className="text-center mb-6">
        <BrandedButton href={loginUrl}>Go to Dashboard</BrandedButton>
      </Section>
      <Text className="text-sm text-gray-500 leading-5 m-0">
        If the button doesn&apos;t work, copy this link:{" "}
        <Link href={loginUrl} className="text-brand underline">
          {loginUrl}
        </Link>
      </Text>
    </Layout>
  );
}

WelcomeEmail.PreviewProps = {
  name: "Troy",
  loginUrl: "https://propertyiq.app/dashboard",
} satisfies WelcomeEmailProps;

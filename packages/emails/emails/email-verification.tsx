import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

export interface EmailVerificationProps {
  name: string;
  verificationUrl: string;
}

export default function EmailVerification({
  name,
  verificationUrl,
}: EmailVerificationProps) {
  return (
    <Layout preview="Verify your email address">
      <EmailHeading>Verify your email</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Hi {name},
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-6">
        Please verify your email address by clicking the button below:
      </Text>
      <Section className="text-center mb-6">
        <BrandedButton href={verificationUrl}>Verify Email</BrandedButton>
      </Section>
      <Text className="text-sm text-gray-500 leading-5 m-0">
        If the button doesn&apos;t work, copy this link:{" "}
        <Link href={verificationUrl} className="text-brand underline">
          {verificationUrl}
        </Link>
      </Text>
    </Layout>
  );
}

EmailVerification.PreviewProps = {
  name: "Troy",
  verificationUrl: "https://propertyiq.app/verify?token=abc123",
} satisfies EmailVerificationProps;

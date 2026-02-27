import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

export interface PasswordResetProps {
  name: string;
  resetUrl: string;
  expiresIn: string;
}

export default function PasswordReset({
  name,
  resetUrl,
  expiresIn,
}: PasswordResetProps) {
  return (
    <Layout preview="Reset your PropertyIQ password">
      <EmailHeading>Reset your password</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Hi {name},
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-6">
        We received a request to reset your password. Click the button below to
        choose a new one. This link expires in {expiresIn}.
      </Text>
      <Section className="text-center mb-6">
        <BrandedButton href={resetUrl}>Reset Password</BrandedButton>
      </Section>
      <Text className="text-sm text-gray-500 leading-5 m-0 mb-4">
        If the button doesn&apos;t work, copy this link:{" "}
        <Link href={resetUrl} className="text-brand underline">
          {resetUrl}
        </Link>
      </Text>
      <Text className="text-sm text-gray-500 leading-5 m-0">
        If you didn&apos;t request a password reset, you can safely ignore this
        email.
      </Text>
    </Layout>
  );
}

PasswordReset.PreviewProps = {
  name: "Troy",
  resetUrl: "https://propertyiq.app/reset-password?token=xyz789",
  expiresIn: "1 hour",
} satisfies PasswordResetProps;

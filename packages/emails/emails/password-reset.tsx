import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";
import OtpCodeBlock from "./components/otp-code-block";

export interface PasswordResetProps {
  name: string;
  resetUrl: string;
  expiresIn: string;
  /** Standalone-safe alternative to the link — PWA reset links open the
   * phone's browser, not the installed app, so a typed code is the only
   * path that works there. Optional so previews/older callers still render. */
  code?: string;
}

export default function PasswordReset({
  name,
  resetUrl,
  expiresIn,
  code,
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
      {code && (
        <>
          <Text className="text-sm text-gray-500 leading-5 m-0 mb-2">
            Or, if the app asks for a code instead, enter this:
          </Text>
          <OtpCodeBlock code={code} />
        </>
      )}
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
  code: "123456",
} satisfies PasswordResetProps;

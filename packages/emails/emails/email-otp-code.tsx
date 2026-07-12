import { Text } from "@react-email/components";
import Layout from "./components/layout";
import EmailHeading from "./components/email-heading";
import OtpCodeBlock from "./components/otp-code-block";

export interface EmailOtpCodeProps {
  name: string;
  code: string;
  expiresIn?: string;
}

/**
 * Scanner-proof signup confirmation: shows a one-time code the user types,
 * with NO clickable link (email link-scanners prefetch and consume magic-link
 * tokens, which then breaks the user's own click). The 6-digit code cannot be
 * consumed by a prefetch.
 */
export default function EmailOtpCode({
  name,
  code,
  expiresIn = "1 hour",
}: EmailOtpCodeProps) {
  return (
    <Layout preview="Your PropertyIQ verification code">
      <EmailHeading>Verify your email</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Hi {name},
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-6">
        Enter this code on the signup screen to activate your PropertyIQ
        account:
      </Text>
      <OtpCodeBlock code={code} />
      <Text className="text-sm text-gray-500 leading-5 m-0">
        This code expires in {expiresIn}. If you didn&apos;t request it, you can
        safely ignore this email.
      </Text>
    </Layout>
  );
}

EmailOtpCode.PreviewProps = {
  name: "Troy",
  code: "123456",
} satisfies EmailOtpCodeProps;

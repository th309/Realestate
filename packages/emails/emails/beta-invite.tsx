import { Text, Section, Link, Hr } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";

export interface BetaInviteProps {
  name: string;
  testingUrl: string;
  /** If provided, shows a "create your account" section. Omit for users who already have an account. */
  signUpUrl?: string;
}

export default function BetaInvite({
  name,
  testingUrl,
  signUpUrl,
}: BetaInviteProps) {
  return (
    <Layout preview="You're invited to beta test PropertyIQ">
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Hey {name},
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Troy here — I&apos;d love your help testing PropertyIQ, a real estate
        analytics platform I&apos;m building.
      </Text>

      {signUpUrl && (
        <>
          <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
            First, create your free account so you can explore the full app:
          </Text>
          <Section className="text-center mb-6">
            <BrandedButton href={signUpUrl}>Create Your Account</BrandedButton>
          </Section>
          <Hr className="border-gray-200 my-6" />
        </>
      )}

      <Text className="text-base text-gray-700 leading-6 m-0 mb-6">
        {signUpUrl
          ? "Then use this link to submit feedback anytime:"
          : "Click the link below to access the app and submit feedback directly:"}
      </Text>
      <Section className="text-center mb-6">
        <BrandedButton href={testingUrl}>
          {signUpUrl ? "Submit Feedback" : "Start Testing"}
        </BrandedButton>
      </Section>
      <Text className="text-sm text-gray-500 leading-5 m-0 mb-4">
        Your feedback link is unique to you — no login needed. Just use it
        whenever you want to report bugs, suggest features, or share thoughts.
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-2">
        Thanks for helping make PropertyIQ better!
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">— Troy</Text>
      <Text className="text-sm text-gray-500 leading-5 m-0">
        If the button doesn&apos;t work, copy this link:{" "}
        <Link href={testingUrl} className="text-brand underline">
          {testingUrl}
        </Link>
      </Text>
    </Layout>
  );
}

BetaInvite.PreviewProps = {
  name: "Alex",
  testingUrl: "https://propertyiq.app/betatest/abc123",
  signUpUrl: "https://www.propertyiq.app/auth/sign-up",
} satisfies BetaInviteProps;

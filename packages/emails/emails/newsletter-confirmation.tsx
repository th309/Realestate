import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

export interface NewsletterConfirmationProps {
  confirmUrl: string;
}

export default function NewsletterConfirmation({
  confirmUrl,
}: NewsletterConfirmationProps) {
  return (
    <Layout preview="Confirm your PropertyIQ newsletter subscription">
      <EmailHeading>Confirm your subscription</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Thanks for signing up for Weekly Market Insights from PropertyIQ!
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-6">
        Please confirm your email address by clicking the button below:
      </Text>
      <Section className="text-center mb-6">
        <BrandedButton href={confirmUrl}>Confirm Subscription</BrandedButton>
      </Section>
      <Text className="text-sm text-gray-500 leading-5 m-0 mb-4">
        If you didn&apos;t sign up for this newsletter, you can safely ignore
        this email.
      </Text>
      <Text className="text-sm text-gray-500 leading-5 m-0">
        If the button doesn&apos;t work, copy this link:{" "}
        <Link href={confirmUrl} className="text-brand underline">
          {confirmUrl}
        </Link>
      </Text>
    </Layout>
  );
}

NewsletterConfirmation.PreviewProps = {
  confirmUrl: "https://propertyiq.app/api/newsletter/confirm?token=xyz789",
} satisfies NewsletterConfirmationProps;

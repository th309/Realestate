import { Text, Section } from "@react-email/components";

interface OtpCodeBlockProps {
  code: string;
}

/** Large tracked-letter code display shared by templates that offer a typed
 * OTP alternative to their link (signup, password reset, magic-link sign-in). */
export default function OtpCodeBlock({ code }: OtpCodeBlockProps) {
  return (
    <Section className="text-center mb-6">
      <Text className="text-4xl font-bold tracking-[0.4em] text-brand m-0">
        {code}
      </Text>
    </Section>
  );
}

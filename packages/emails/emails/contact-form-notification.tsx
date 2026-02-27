import { Text, Section, Row, Column, Hr } from "@react-email/components";
import Layout from "./components/layout";
import EmailHeading from "./components/email-heading";

export interface ContactFormNotificationProps {
  name: string;
  email: string;
  issueType: string;
  description: string;
}

export default function ContactFormNotification({
  name,
  email,
  issueType,
  description,
}: ContactFormNotificationProps) {
  return (
    <Layout preview={`New contact form: ${issueType}`}>
      <EmailHeading>New Contact Form Submission</EmailHeading>

      <Section className="bg-gray-50 rounded-lg p-4 mb-4">
        <Row>
          <Column className="w-28">
            <Text className="text-sm font-semibold text-gray-600 m-0">
              Name
            </Text>
          </Column>
          <Column>
            <Text className="text-sm text-gray-800 m-0">{name}</Text>
          </Column>
        </Row>
        <Row className="mt-2">
          <Column className="w-28">
            <Text className="text-sm font-semibold text-gray-600 m-0">
              Email
            </Text>
          </Column>
          <Column>
            <Text className="text-sm text-gray-800 m-0">{email}</Text>
          </Column>
        </Row>
        <Row className="mt-2">
          <Column className="w-28">
            <Text className="text-sm font-semibold text-gray-600 m-0">
              Issue Type
            </Text>
          </Column>
          <Column>
            <Text className="text-sm text-gray-800 m-0">{issueType}</Text>
          </Column>
        </Row>
      </Section>

      <Hr className="border-solid border-gray-200 my-4" />

      <Text className="text-sm font-semibold text-gray-600 m-0 mb-2">
        Message
      </Text>
      <Text className="text-sm text-gray-800 leading-6 m-0 whitespace-pre-wrap">
        {description}
      </Text>
    </Layout>
  );
}

ContactFormNotification.PreviewProps = {
  name: "Jane Doe",
  email: "jane@example.com",
  issueType: "Bug Report",
  description:
    "The map is not loading when I select ZIP code level data.\n\nSteps to reproduce:\n1. Go to the map page\n2. Select ZIP code geography\n3. Page stays blank",
} satisfies ContactFormNotificationProps;

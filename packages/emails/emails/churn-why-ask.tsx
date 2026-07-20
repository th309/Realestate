import { Text, Section, Row, Column } from "@react-email/components";
import Layout from "./components/layout";
import EmailHeading from "./components/email-heading";
import {
  CHURN_REASON_LABELS,
  CHURN_WHY_ZERO_SESSION,
  type ChurnWhyCopy,
} from "../copy/email-copy";

export interface ChurnWhyAskProps {
  name: string;
  copy: ChurnWhyCopy;
  whyDidYouLeaveUrl: string;
  token: string;
  unsubscribeUrl?: string;
}

export default function ChurnWhyAsk({
  name,
  copy,
  whyDidYouLeaveUrl,
  token,
  unsubscribeUrl,
}: ChurnWhyAskProps) {
  return (
    <Layout preview={copy.preview} unsubscribeUrl={unsubscribeUrl}>
      <EmailHeading>{copy.heading}</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        {copy.greeting(name)}
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-5">
        {copy.body}
      </Text>
      <Section className="mb-2">
        <Row>
          {copy.reasonCodes.map((code) => (
            <Column key={code} className="pb-2 pr-2">
              <a
                href={`${whyDidYouLeaveUrl}?token=${token}&reason=${code}`}
                className="inline-block bg-brand-light text-brand text-sm font-medium px-4 py-2 rounded-full no-underline"
                style={{ textDecoration: "none" }}
              >
                {CHURN_REASON_LABELS[code]}
              </a>
            </Column>
          ))}
        </Row>
      </Section>
    </Layout>
  );
}

ChurnWhyAsk.PreviewProps = {
  name: "Troy",
  copy: CHURN_WHY_ZERO_SESSION,
  whyDidYouLeaveUrl: "https://propertyiq.app/why-did-you-leave",
  token: "preview-token",
} satisfies ChurnWhyAskProps;

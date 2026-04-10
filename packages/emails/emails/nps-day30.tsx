import { Text, Section, Row, Column, Link } from "@react-email/components";
import Layout from "./components/layout";
import EmailHeading from "./components/email-heading";

export interface NpsDay30Props {
  name: string;
  surveyBaseUrl: string;
  token: string;
}

const SCORES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function NpsDay30({ name, surveyBaseUrl, token }: NpsDay30Props) {
  return (
    <Layout preview="How likely are you to recommend PropertyIQ? (30 seconds)">
      <EmailHeading>How are we doing?</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Hey {name},
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        You&apos;ve been using PropertyIQ for 30 days. We&apos;d love to know
        how it&apos;s going — takes about 30 seconds.
      </Text>

      <Text className="text-sm font-semibold text-gray-900 m-0 mb-3">
        How likely are you to recommend PropertyIQ to a colleague or friend?
      </Text>
      <Text className="text-xs text-gray-500 m-0 mb-4">
        0 = Not at all likely &nbsp;&nbsp; 10 = Extremely likely
      </Text>

      {/* NPS score grid — 0-6 in first row, 7-10 in second */}
      <Section className="mb-2">
        <Row>
          {SCORES.slice(0, 7).map((score) => (
            <Column key={score} className="text-center px-1">
              <Link
                href={`${surveyBaseUrl}?token=${token}&score=${score}`}
                className="inline-block w-9 h-9 leading-9 rounded-full text-sm font-medium text-white no-underline"
                style={{
                  backgroundColor: score <= 6 ? "#ef4444" : score <= 8 ? "#f59e0b" : "#22c55e",
                  textDecoration: "none",
                }}
              >
                {score}
              </Link>
            </Column>
          ))}
        </Row>
      </Section>
      <Section className="mb-6">
        <Row>
          {SCORES.slice(7).map((score) => (
            <Column key={score} className="text-center px-1">
              <Link
                href={`${surveyBaseUrl}?token=${token}&score=${score}`}
                className="inline-block w-9 h-9 leading-9 rounded-full text-sm font-medium text-white no-underline"
                style={{
                  backgroundColor: score <= 8 ? "#f59e0b" : "#22c55e",
                  textDecoration: "none",
                }}
              >
                {score}
              </Link>
            </Column>
          ))}
        </Row>
      </Section>

      <Text className="text-xs text-gray-400 leading-5 m-0">
        Clicking a number takes you to a brief survey page where you can also
        leave a comment. Your feedback shapes what we build next.
      </Text>
    </Layout>
  );
}

NpsDay30.PreviewProps = {
  name: "Troy",
  surveyBaseUrl: "https://propertyiq.app/survey",
  token: "preview-token",
} satisfies NpsDay30Props;

import { Text, Section, Hr } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";
import { WINBACK_DAY14 } from "../copy/email-copy";

export interface WinbackDay14Props {
  name: string;
  loginUrl: string;
}

export default function WinbackDay14({ name, loginUrl }: WinbackDay14Props) {
  const mapUrl = `${loginUrl}/map`;
  const marketsUrl = `${loginUrl}/markets`;

  return (
    <Layout preview={WINBACK_DAY14.preview}>
      <EmailHeading>{WINBACK_DAY14.heading}</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        {WINBACK_DAY14.greeting(name)}
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        {WINBACK_DAY14.body}
      </Text>

      <Hr className="border-gray-200 my-5" />

      <Text className="text-sm font-semibold text-gray-900 m-0 mb-2">
        {WINBACK_DAY14.whatsNewHeading}
      </Text>
      {WINBACK_DAY14.whatsNew.map((item, index) => (
        <Text
          key={item}
          className={
            index === WINBACK_DAY14.whatsNew.length - 1
              ? "text-sm text-gray-600 leading-5 m-0 mb-5"
              : "text-sm text-gray-600 leading-5 m-0 mb-1"
          }
        >
          {item}
        </Text>
      ))}

      <Hr className="border-gray-200 my-5" />

      <Section className="text-center mb-5">
        <BrandedButton href={mapUrl}>{WINBACK_DAY14.cta}</BrandedButton>
      </Section>

      <Text className="text-sm text-gray-500 leading-5 m-0">
        {WINBACK_DAY14.browseLeadIn}{" "}
        <a href={marketsUrl} className="text-brand underline">
          {WINBACK_DAY14.browseLinkText}
        </a>
        .
      </Text>
    </Layout>
  );
}

WinbackDay14.PreviewProps = {
  name: "Troy",
  loginUrl: "https://propertyiq.app",
} satisfies WinbackDay14Props;

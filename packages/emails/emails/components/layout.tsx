import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Link,
  Font,
  Tailwind,
} from "@react-email/components";

interface LayoutProps {
  preview: string;
  children: React.ReactNode;
  unsubscribeUrl?: string;
}

const brandColor = "#6750A4";

export default function Layout({
  preview,
  children,
  unsubscribeUrl,
}: LayoutProps) {
  return (
    <Html lang="en">
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                brand: brandColor,
                "brand-light": "#f5f3ff",
              },
            },
          },
        }}
      >
        <Head>
          <Font
            fontFamily="Roboto"
            fallbackFontFamily="Arial"
            webFont={{
              url: "https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbGmT.woff2",
              format: "woff2",
            }}
            fontWeight={400}
            fontStyle="normal"
          />
        </Head>
        <Preview>{preview}</Preview>
        <Body className="bg-gray-100 font-sans py-10">
          <Container
            className="bg-white rounded-xl mx-auto p-0"
            style={{ maxWidth: "600px" }}
          >
            <Section
              className="px-10 pt-8 pb-6"
              style={{ borderBottom: `3px solid ${brandColor}` }}
            >
              <Text
                className="text-2xl font-bold m-0"
                style={{ color: brandColor }}
              >
                PropertyIQ
              </Text>
            </Section>
            <Section className="px-10 py-6">{children}</Section>
            <Section
              className="px-10 pt-6 pb-8 bg-gray-50"
              style={{ borderTop: "1px solid #e5e5e5" }}
            >
              <Text className="text-xs text-gray-400 m-0 leading-5">
                PropertyIQ
              </Text>
              {unsubscribeUrl && (
                <Text className="text-xs text-gray-400 m-0 mt-1">
                  <Link
                    href={unsubscribeUrl}
                    className="text-gray-400 underline"
                  >
                    Unsubscribe
                  </Link>{" "}
                  or{" "}
                  <Link
                    href="https://propertyiq.app/account/notifications"
                    className="text-gray-400 underline"
                  >
                    manage preferences
                  </Link>
                </Text>
              )}
              <Text className="text-xs text-gray-400 m-0 mt-1">
                &copy; {new Date().getFullYear()} PropertyIQ. All rights
                reserved.
              </Text>
              <Text className="text-xs text-gray-400 m-0 mt-1 leading-5">
                Republic Registered Agent LLC &middot; 20 S Charles St, Ste 403
                &middot; Baltimore, MD 21201
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

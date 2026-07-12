import type { Metadata } from "next";
import { Shield } from "lucide-react";
import { PageHeaderWithBreadcrumbs } from "@/components/navigation";
import { Section, Callout, ContactCard } from "../terms/TermsComponents";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Read PropertyIQ's Privacy Policy covering data collection, usage, third-party sharing, cookies, and your privacy rights.",
  alternates: { canonical: "https://www.propertyiq.app/about/privacy" },
  openGraph: {
    title: "Privacy Policy | PropertyIQ",
    description:
      "Read PropertyIQ's Privacy Policy covering data collection, usage, third-party sharing, cookies, and your privacy rights.",
    url: "https://www.propertyiq.app/about/privacy",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-dvh bg-surface">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <PageHeaderWithBreadcrumbs
          breadcrumbs={[
            { label: "About", href: "/about" },
            { label: "Privacy Policy" },
          ]}
          title="Privacy Policy"
          description="PropertyIQ — Operated by Federal Contracting Services LLC"
          icon={<Shield className="w-5 h-5" />}
        />

        <div className="mt-4 mb-10">
          <span className="inline-block text-xs font-semibold text-primary bg-primary/10 px-3.5 py-1.5 rounded-full">
            Effective Date: April 4, 2026
          </span>
        </div>

        <main>
          <Section id="introduction" number={1} title="Introduction">
            <p>
              Federal Contracting Services LLC (&ldquo;Company,&rdquo;
              &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates
              PropertyIQ (
              <a
                href="https://propertyiq.app"
                className="text-primary hover:underline"
              >
                https://propertyiq.app
              </a>
              ), a real estate analytics platform. This Privacy Policy describes
              how we collect, use, disclose, and protect your personal
              information when you use our website, APIs, AI-powered tools, and
              related services (collectively, the &ldquo;Service&rdquo;).
            </p>
            <p>
              By accessing or using the Service, you consent to the data
              practices described in this Privacy Policy. If you do not agree
              with these practices, please do not use the Service.
            </p>
          </Section>

          <Section
            id="information-collected"
            number={2}
            title="Information We Collect"
          >
            <p>
              <strong className="text-on-surface">Account Information.</strong>{" "}
              When you create an account, we collect your name, email address,
              and authentication credentials. If you subscribe to a paid plan,
              we collect billing information through our payment processor
              (Stripe).
            </p>
            <p>
              <strong className="text-on-surface">Usage Data.</strong> We
              automatically collect information about how you interact with the
              Service, including pages visited, features used, search queries,
              geographic areas analyzed, and timestamps.
            </p>
            <p>
              <strong className="text-on-surface">
                Device &amp; Technical Data.
              </strong>{" "}
              We collect browser type, operating system, IP address, device
              identifiers, and similar technical information.
            </p>
            <p>
              <strong className="text-on-surface">AI Interaction Data.</strong>{" "}
              When you use our AI-powered features or third-party AI connectors
              (such as Claude, ChatGPT, or other MCP-compatible clients), we
              process the queries you submit and the responses generated. We do
              not store the content of individual AI conversations beyond what
              is necessary for the session.
            </p>
            <p>
              <strong className="text-on-surface">
                Third-Party Authentication.
              </strong>{" "}
              If you connect to PropertyIQ through a third-party platform (e.g.,
              Claude.ai, ChatGPT), we receive limited profile information
              (user&nbsp;ID, email) through the OAuth authentication flow. We do
              not receive your password or credentials for those platforms.
            </p>
          </Section>

          <Section
            id="how-we-use"
            number={3}
            title="How We Use Your Information"
          >
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>Provide, operate, and improve the Service</li>
              <li>Process transactions and manage your subscription</li>
              <li>Authenticate your identity and enforce access controls</li>
              <li>
                Generate market analytics, scores, and AI-powered insights
              </li>
              <li>
                Communicate with you about your account, updates, and
                promotional offers (with opt-out)
              </li>
              <li>
                Detect, prevent, and address fraud, abuse, and security issues
              </li>
              <li>
                Comply with legal obligations and enforce our Terms of Service
              </li>
              <li>
                Aggregate and anonymize data for analytics and product
                improvement
              </li>
            </ul>
          </Section>

          <Section
            id="data-sharing"
            number={4}
            title="How We Share Your Information"
          >
            <p>
              We do not sell your personal information. We may share your
              information in the following circumstances:
            </p>
            <p>
              <strong className="text-on-surface">Service Providers.</strong> We
              share data with trusted third-party providers who help us operate
              the Service, including Supabase (database and authentication),
              Stripe (payment processing), Railway (hosting), Mapbox (mapping
              services), and analytics providers.
            </p>
            <p>
              <strong className="text-on-surface">
                AI Technology Partners.
              </strong>{" "}
              When you use PropertyIQ through AI platforms (Claude, ChatGPT, or
              other MCP clients), your queries are processed through our API. We
              send market data responses back to those platforms to fulfill your
              requests. We do not share your personal information with AI
              technology partners beyond what is necessary for authentication
              and service delivery.
            </p>
            <p>
              <strong className="text-on-surface">Legal Requirements.</strong>{" "}
              We may disclose your information if required by law, court order,
              or governmental regulation, or if we believe disclosure is
              necessary to protect our rights, your safety, or the safety of
              others.
            </p>
            <p>
              <strong className="text-on-surface">Business Transfers.</strong>{" "}
              In the event of a merger, acquisition, or sale of assets, your
              information may be transferred as part of that transaction.
            </p>
          </Section>

          <Section id="cookies" number={5} title="Cookies & Tracking">
            <p>
              We use cookies and similar tracking technologies to maintain your
              session, remember preferences, and analyze usage patterns. You can
              control cookie settings through your browser. Disabling cookies
              may limit certain features of the Service.
            </p>
            <p>
              We use Google Analytics to understand how users interact with the
              Service. Google Analytics collects anonymized usage data. You may
              opt out by installing the Google Analytics opt-out browser add-on.
            </p>
          </Section>

          <Section id="data-security" number={6} title="Data Security">
            <p>
              We implement industry-standard security measures to protect your
              personal information, including encryption in transit (TLS/SSL),
              encrypted storage for sensitive data, row-level security policies,
              and regular security reviews. However, no method of transmission
              over the Internet or electronic storage is 100% secure, and we
              cannot guarantee absolute security.
            </p>
          </Section>

          <Section id="data-retention" number={7} title="Data Retention">
            <p>
              We retain your personal information for as long as your account is
              active or as needed to provide the Service. If you delete your
              account, we will delete or anonymize your personal information
              within 30 days, except where retention is required by law or
              legitimate business purposes (e.g., fraud prevention, legal
              compliance).
            </p>
          </Section>

          <Section id="your-rights" number={8} title="Your Privacy Rights">
            <p>
              Depending on your jurisdiction, you may have the following rights:
            </p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                <strong className="text-on-surface">Access</strong> — Request a
                copy of the personal information we hold about you
              </li>
              <li>
                <strong className="text-on-surface">Correction</strong> —
                Request that we correct inaccurate or incomplete information
              </li>
              <li>
                <strong className="text-on-surface">Deletion</strong> — Request
                that we delete your personal information
              </li>
              <li>
                <strong className="text-on-surface">Portability</strong> —
                Request your data in a structured, machine-readable format
              </li>
              <li>
                <strong className="text-on-surface">Opt-Out</strong> — Opt out
                of marketing communications at any time
              </li>
            </ul>
            <p>
              To exercise any of these rights, contact us at{" "}
              <a
                href="mailto:privacy@propertyiq.app"
                className="text-primary hover:underline"
              >
                privacy@propertyiq.app
              </a>
              . We will respond within 30 days.
            </p>
          </Section>

          <Section id="children" number={9} title="Children's Privacy">
            <p>
              The Service is not directed to individuals under the age of 18. We
              do not knowingly collect personal information from children. If we
              become aware that we have collected personal information from a
              child under 18, we will take steps to delete that information
              promptly.
            </p>
          </Section>

          <Section id="changes" number={10} title="Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of material changes by posting the updated policy on
              this page and updating the &ldquo;Effective Date&rdquo; above.
              Your continued use of the Service after changes are posted
              constitutes your acceptance of the revised Privacy Policy.
            </p>
          </Section>

          <Section id="contact" number={11} title="Contact Us">
            <p>
              If you have questions or concerns about this Privacy Policy or our
              data practices, contact us:
            </p>
            <ContactCard />
          </Section>

          <div className="mt-12 pt-8 border-t border-outline-variant">
            <p className="text-center text-sm text-on-surface-variant">
              By using PropertyIQ, you acknowledge that you have read,
              understood, and agree to this Privacy Policy.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

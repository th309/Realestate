import { Section, Callout } from "./TermsComponents";

/**
 * Section 10: Data Privacy and Security.
 *
 * Split out of TermsSectionsRights.tsx, which passed the 400-line hard limit
 * once the activity-tracking and session-recording disclosure was added. This
 * section is also the one most likely to keep changing as data practices do, so
 * it earns its own file rather than sitting inside a grab bag of sections 9
 * through 12.
 *
 * Kept in sync with the Privacy Policy, which these Terms incorporate by
 * reference. If the two disagree about what is collected, that contradiction is
 * the bug, not a difference of emphasis.
 */
export function DataPrivacySections() {
  return (
    <Section id="data-privacy" number={10} title="Data Privacy & Security">
      <p>
        We take the privacy and security of your data seriously. Our collection,
        use, storage, and disclosure of personal information is governed by our{" "}
        <strong className="text-on-surface">Privacy Policy</strong>, which is
        incorporated into these Terms by reference. By using the Service, you
        consent to the practices described in our Privacy Policy.
      </p>

      <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
        10.1 Data Collection
      </h3>
      <p>
        We collect information you provide directly (such as account
        registration information, search queries, and preferences), information
        generated through your use of the Service (such as usage analytics and
        interaction logs), and information from third-party data sources (such
        as public real estate records, census data, and economic indicators).
      </p>
      <p>
        Your activity on the Service may be tracked for marketing and site
        improvement purposes. This includes the pages you visit, the features
        you use, the searches you run, the markets you analyze, and the errors
        or plan limits you encounter. Where you are signed in, this activity is
        associated with your account. We also record a sample of sessions, and
        sessions in which an error occurs, and replay them to diagnose problems;
        text is masked and media is blocked in those recordings, and we do not
        capture form field contents, passwords, or payment card details. See our
        Privacy Policy for the full description and for how to limit this
        collection.
      </p>

      <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
        10.2 Data Use
      </h3>
      <p>
        Your data is used to provide and personalize the Service, to improve and
        train our AI models and algorithms, to communicate with you regarding
        your account and the Service, and to comply with legal obligations. We
        also use it to analyze how the Service is used, both by you individually
        and across customers in aggregate, in order to improve the product,
        decide what to build next, measure our marketing, and shape the offers
        and communications you receive. We do not sell your activity data, and
        we do not share it with advertising networks.
      </p>

      <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
        10.3 Data Security
      </h3>
      <p>
        We implement commercially reasonable administrative, technical, and
        physical safeguards designed to protect your data against unauthorized
        access, alteration, disclosure, or destruction. However, no method of
        electronic transmission or storage is 100% secure, and we cannot
        guarantee absolute security.
      </p>

      <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
        10.4 Data Sharing
      </h3>
      <p>
        We may share your data with Technology Partners as described in Section
        11, with service providers who assist in operating the Service, and as
        required by law or legal process. We do not sell your personal
        information to third parties.
      </p>

      <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
        10.5 Analytics &amp; Tracking Technologies
      </h3>
      <p>
        The Service uses Google Analytics and may use other third-party
        analytics services to collect and process information about how you
        interact with our website and application properties. Google Analytics
        collects visitation information such as pages viewed, session duration,
        referring URLs, device and browser type, IP address (which may be
        anonymized), geographic location, and user interaction events.
      </p>
      <p>By using the Service, you acknowledge and agree that:</p>
      <ul className="list-disc pl-6 space-y-1.5">
        <li>
          We collect and process data related to your use of the Service,
          including through the use of cookies, pixels, and similar tracking
          technologies.
        </li>
        <li>
          Data you provide to the Service — including account information,
          search queries, preferences, and usage behavior — may be associated
          with the visitation and interaction data that Google Analytics
          collects from our website and/or application properties.
        </li>
        <li>
          This associated data is used to analyze usage patterns, improve the
          Service, personalize your experience, measure the effectiveness of
          features, and support our business operations.
        </li>
        <li>
          Google processes this data in accordance with its own privacy policy
          and terms of service. For more information on how Google collects and
          processes data, please visit{" "}
          <a
            href="https://policies.google.com/technologies/partner-sites"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Google&apos;s Partner Sites Privacy Information
          </a>
          .
        </li>
        <li>
          You may opt out of Google Analytics tracking by installing the{" "}
          <a
            href="https://tools.google.com/dlpage/gaoptout"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Google Analytics Opt-Out Browser Add-on
          </a>{" "}
          or by adjusting your cookie preferences through our cookie consent
          mechanisms where available.
        </li>
      </ul>
      <Callout label="Your Acknowledgment">
        <p>
          By accessing or using the Service, you acknowledge that Federal
          Contracting Services LLC maintains the necessary privacy disclosures
          regarding the collection and processing of your data, including the
          association of such data with the visitation information that Google
          Analytics collects from our website and/or application properties. You
          consent to this collection, processing, and association of data as
          described in these Terms and our Privacy Policy.
        </p>
      </Callout>

      <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
        10.6 Cookie Policy
      </h3>
      <p>
        The Service uses cookies and similar technologies for essential site
        functionality, analytics, and personalization. Cookies may be set by us
        (first-party cookies) or by third-party services we use, including
        Google Analytics. By continuing to use the Service, you consent to the
        use of cookies as described herein. You may manage or disable cookies
        through your browser settings; however, doing so may impair certain
        features of the Service.
      </p>
    </Section>
  );
}

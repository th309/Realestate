import { Section, Callout } from './TermsComponents';

/** Sections 9–12: Intellectual Property through White Label */
export function RightsSections() {
  return (
    <>
      {/* 9 — IP Rights */}
      <Section id="ip-rights" number={9} title="Intellectual Property Rights">
        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          9.1 Company Intellectual Property
        </h3>
        <p>
          The Service, including all software, algorithms, scoring methodologies (including
          HomeReady&trade; and InvestorEdge&trade;), user interface designs, trademarks, trade names,
          logos, documentation, and all other proprietary materials, are and shall remain the exclusive
          property of Federal Contracting Services LLC and its licensors. Nothing in these Terms
          grants you any right, title, or interest in our intellectual property except as expressly
          stated herein.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          9.2 AI-Generated Content Ownership
        </h3>
        <p>Ownership of AI-Generated Content is subject to the following terms:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>
            To the extent that AI-Generated Content qualifies for copyright protection under
            applicable law, Federal Contracting Services LLC retains all rights in and to the AI
            models, algorithms, and underlying systems that produce such content.
          </li>
          <li>
            You are granted a limited, non-exclusive, non-transferable, revocable license to use
            AI-Generated Content produced during your use of the Service for your personal or internal
            business purposes, subject to these Terms.
          </li>
          <li>
            You acknowledge that AI-Generated Content may not be eligible for copyright protection
            under current United States Copyright Office guidance, and you assume the risk associated
            with any claim of copyright ownership over such content.
          </li>
          <li>
            We make no representation or warranty that AI-Generated Content is unique to you. Similar
            or identical content may be generated for other users.
          </li>
        </ul>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">9.3 User Content</h3>
        <p>
          You retain ownership of User Content that you submit to the Service. By submitting User
          Content, you grant Federal Contracting Services LLC a worldwide, non-exclusive, royalty-free,
          sublicensable license to use, process, store, and analyze such content for the purpose of
          providing, improving, and developing the Service. This license survives termination of your
          account to the extent necessary to fulfill the purposes described herein.
        </p>
      </Section>

      {/* 10 — Data Privacy */}
      <Section id="data-privacy" number={10} title="Data Privacy & Security">
        <p>
          We take the privacy and security of your data seriously. Our collection, use, storage, and
          disclosure of personal information is governed by our{' '}
          <strong className="text-on-surface">Privacy Policy</strong>, which is incorporated into
          these Terms by reference. By using the Service, you consent to the practices described in
          our Privacy Policy.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">10.1 Data Collection</h3>
        <p>
          We collect information you provide directly (such as account registration information,
          search queries, and preferences), information generated through your use of the Service
          (such as usage analytics and interaction logs), and information from third-party data sources
          (such as public real estate records, census data, and economic indicators).
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">10.2 Data Use</h3>
        <p>
          Your data is used to provide and personalize the Service, to improve and train our AI models
          and algorithms, to communicate with you regarding your account and the Service, and to
          comply with legal obligations.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">10.3 Data Security</h3>
        <p>
          We implement commercially reasonable administrative, technical, and physical safeguards
          designed to protect your data against unauthorized access, alteration, disclosure, or
          destruction. However, no method of electronic transmission or storage is 100% secure, and we
          cannot guarantee absolute security.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">10.4 Data Sharing</h3>
        <p>
          We may share your data with Technology Partners as described in Section 11, with service
          providers who assist in operating the Service, and as required by law or legal process. We
          do not sell your personal information to third parties.
        </p>
      </Section>

      {/* 11 — Technology Partners */}
      <Section id="technology-partners" number={11} title="Use of Technology Partners">
        <Callout label="Transparency Notice">
          <p>
            PropertyIQ integrates artificial intelligence models and services developed by third-party
            Technology Partners. Your data may be shared with these partners to the extent necessary to
            provide the Service.
          </p>
        </Callout>
        <p>
          The AI Features of PropertyIQ may rely on large language models, machine learning
          infrastructure, data processing services, and APIs provided by third-party companies
          (&ldquo;Technology Partners&rdquo;). By using the Service, you acknowledge and agree that:
        </p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>
            Certain data you provide to the Service, including queries, prompts, and contextual data,
            may be transmitted to Technology Partners for processing in order to deliver AI-Generated
            Content.
          </li>
          <li>
            Technology Partners maintain their own terms of service, privacy policies, and data
            handling practices, which may differ from ours.
          </li>
          <li>
            We select Technology Partners with commercially reasonable care, but we are not responsible
            for the data handling practices of our Technology Partners beyond our contractual
            agreements with them.
          </li>
          <li>
            We may change Technology Partners from time to time without prior notice to you, provided
            that any such change does not materially diminish the protections afforded to your data
            under our Privacy Policy.
          </li>
        </ul>
        <p>
          A current list of our principal Technology Partners may be made available in our Privacy
          Policy or upon request.
        </p>
      </Section>

      {/* 12 — White Label */}
      <Section id="white-label" number={12} title="White Label Use by Real Estate Professionals">
        <p>
          PropertyIQ may offer white label licensing arrangements that permit licensed real estate
          professionals, agents, brokers, and brokerages (&ldquo;White Label Partners&rdquo;) to
          integrate, rebrand, or embed certain PropertyIQ features and data within their own websites,
          applications, client portals, or marketing materials (the &ldquo;White Label Service&rdquo;).
          White Label use is subject to the following terms in addition to all other provisions of
          these Terms.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          12.1 Eligibility &amp; Authorization
        </h3>
        <p>
          White Label access is available exclusively to individuals or entities that hold a valid,
          active real estate license in the jurisdiction(s) in which they operate, or to brokerages
          and firms employing or supervising such licensees. White Label use requires a separate
          written White Label Agreement executed between the White Label Partner and Federal
          Contracting Services LLC. Access to the White Label Service without a valid White Label
          Agreement is prohibited.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">12.2 Permitted Use</h3>
        <p>Subject to an active White Label Agreement, White Label Partners may:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>
            Embed designated PropertyIQ data, scores, analytics, and AI-Generated Content within their
            own branded client-facing platforms and materials.
          </li>
          <li>
            Display PropertyIQ-powered insights under the White Label Partner&apos;s trade name,
            branding, and visual identity as authorized in the White Label Agreement.
          </li>
          <li>
            Use PropertyIQ data and AI-Generated Content in listing presentations, buyer
            consultations, market reports, and comparable marketing activities in the ordinary course
            of their real estate business.
          </li>
          <li>
            Provide their clients with access to PropertyIQ features through the White Label
            Partner&apos;s own platform or portal, subject to the usage limits specified in the
            applicable White Label Agreement.
          </li>
        </ul>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          12.3 White Label Partner Obligations
        </h3>
        <p>White Label Partners agree to the following obligations:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>
            <strong className="text-on-surface">AI &amp; Data Disclaimers.</strong> White Label
            Partners must display the AI Disclaimer set forth in Section 5 (or a substantially
            equivalent disclaimer approved in writing by Federal Contracting Services LLC) in any
            client-facing interface, report, or material that includes AI-Generated Content.
          </li>
          <li>
            <strong className="text-on-surface">No Professional Advice Representation.</strong> White
            Label Partners shall not represent or imply to their clients or the public that PropertyIQ
            data, scores, or AI-Generated Content constitutes a formal appraisal, investment
            recommendation, legal opinion, or any form of licensed professional advice.
          </li>
          <li>
            <strong className="text-on-surface">Fair Housing Compliance.</strong> White Label Partners
            shall not use or deploy PropertyIQ data or AI-Generated Content in any manner that
            violates the Fair Housing Act, the Equal Credit Opportunity Act, or any applicable state
            or local fair housing laws.
          </li>
          <li>
            <strong className="text-on-surface">Accuracy Representations.</strong> White Label
            Partners shall not represent to their clients that PropertyIQ data or AI-Generated Content
            is guaranteed to be accurate, complete, or current beyond the representations made by
            Federal Contracting Services LLC in these Terms.
          </li>
          <li>
            <strong className="text-on-surface">Licensing Compliance.</strong> White Label Partners
            shall maintain all required real estate licenses, certifications, and regulatory
            registrations throughout the term of the White Label Agreement.
          </li>
          <li>
            <strong className="text-on-surface">Client Data.</strong> White Label Partners are solely
            responsible for obtaining all necessary consents from their clients before submitting
            client data to PropertyIQ for processing.
          </li>
        </ul>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          12.4 Restrictions on White Label Use
        </h3>
        <p>White Label Partners shall not:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>
            Sublicense, resell, or redistribute the White Label Service to other agents, brokers,
            brokerages, or third parties without prior written consent from Federal Contracting
            Services LLC.
          </li>
          <li>
            Modify, alter, or reverse-engineer the underlying PropertyIQ algorithms, scoring models,
            or data infrastructure accessed through the White Label Service.
          </li>
          <li>Remove, obscure, or modify any required disclaimers, attributions, or notices.</li>
          <li>
            Use the White Label Service in a manner that implies endorsement, sponsorship, or
            affiliation by Federal Contracting Services LLC beyond what is authorized in the White
            Label Agreement.
          </li>
          <li>
            Represent AI-Generated Content as the White Label Partner&apos;s own original analysis or
            proprietary data without appropriate attribution or disclaimer.
          </li>
          <li>
            Exceed the usage limits, API call limits, or seat limits specified in the applicable White
            Label Agreement.
          </li>
        </ul>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          12.5 Intellectual Property in White Label Context
        </h3>
        <p>
          All intellectual property rights in the PropertyIQ platform, AI models, scoring algorithms,
          data pipelines, and underlying technology remain the sole property of Federal Contracting
          Services LLC. The White Label Agreement grants a limited, non-exclusive, non-transferable,
          revocable license to use designated elements of the Service under the White Label
          Partner&apos;s branding. No ownership interest in any PropertyIQ intellectual property is
          transferred to the White Label Partner.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          12.6 Indemnification by White Label Partners
        </h3>
        <p>
          In addition to the general indemnification obligations set forth in Section 19, White Label
          Partners agree to indemnify, defend, and hold harmless Federal Contracting Services LLC from
          any claims, damages, losses, or liabilities arising from the White Label Partner&apos;s
          deployment, presentation, or use of PropertyIQ data and AI-Generated Content, including but
          not limited to claims by the White Label Partner&apos;s clients, regulatory actions, fair
          housing complaints, and intellectual property disputes.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          12.7 Termination of White Label Access
        </h3>
        <p>
          Federal Contracting Services LLC may suspend or terminate a White Label Partner&apos;s
          access to the White Label Service immediately upon breach of these Terms, the applicable
          White Label Agreement, or any applicable law or regulation. Upon termination, the White
          Label Partner must immediately cease all use of PropertyIQ data, branding elements, and
          AI-Generated Content in their platforms and materials, and must remove or disable all
          embedded PropertyIQ features within thirty (30) days of termination.
        </p>

        <Callout label="Note">
          <p>
            White Label arrangements are governed by the applicable White Label Agreement in
            conjunction with these Terms. In the event of a conflict between the White Label Agreement
            and these Terms, the White Label Agreement shall control with respect to the specific terms
            of the white label relationship. For all other matters, these Terms shall govern.
          </p>
        </Callout>
      </Section>
    </>
  );
}

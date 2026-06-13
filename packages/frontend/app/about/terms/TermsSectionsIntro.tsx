import { Section, Callout } from "./TermsComponents";

/** Sections 1–8: Introduction through AI-Generated Content */
export function IntroSections() {
  return (
    <>
      {/* 1 — Introduction */}
      <Section
        id="introduction"
        number={1}
        title="Introduction & Acceptance of Terms"
      >
        <p>
          Welcome to PropertyIQ (
          <a
            href="https://propertyiq.app"
            className="text-primary hover:underline"
          >
            https://propertyiq.app
          </a>
          ), a real estate analytics platform owned and operated by{" "}
          <strong className="text-on-surface">
            Federal Contracting Services LLC
          </strong>
          , a Maryland limited liability company (&ldquo;Company,&rdquo;
          &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;).
        </p>
        <p>
          By accessing or using PropertyIQ, including any associated websites,
          mobile applications, APIs, AI-powered tools, and related services
          (collectively, the &ldquo;Service&rdquo;), you (&ldquo;User,&rdquo;
          &ldquo;you,&rdquo; or &ldquo;your&rdquo;) agree to be bound by these
          Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to all of
          these Terms, you must not access or use the Service.
        </p>
        <p>
          These Terms constitute a legally binding agreement between you and
          Federal Contracting Services LLC. Please read them carefully. These
          Terms contain a{" "}
          <strong className="text-on-surface">
            binding arbitration agreement
          </strong>{" "}
          and a <strong className="text-on-surface">class action waiver</strong>{" "}
          in Sections 21 and 22 that affect your legal rights. By using the
          Service, you agree to resolve disputes through individual arbitration
          and waive any right to participate in class actions.
        </p>
      </Section>

      {/* 2 — Definitions */}
      <Section id="definitions" number={2} title="Definitions">
        <p>Throughout these Terms, the following definitions apply:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>
            <strong className="text-on-surface">
              &ldquo;AI Features&rdquo;
            </strong>{" "}
            means any artificial intelligence, machine learning, or
            algorithmically generated features of the Service, including but not
            limited to the PropertyIQ Score, AI-generated market reports, market
            predictions, and any other automated analysis or content generation.
          </li>
          <li>
            <strong className="text-on-surface">
              &ldquo;AI-Generated Content&rdquo;
            </strong>{" "}
            means any text, data, analysis, scores, reports, recommendations, or
            other output produced in whole or in part by the AI Features.
          </li>
          <li>
            <strong className="text-on-surface">
              &ldquo;User Content&rdquo;
            </strong>{" "}
            means any data, information, text, or materials that you submit,
            upload, or transmit to the Service.
          </li>
          <li>
            <strong className="text-on-surface">
              &ldquo;Subscription&rdquo;
            </strong>{" "}
            means a paid plan that grants you access to certain premium features
            of the Service for a defined period.
          </li>
          <li>
            <strong className="text-on-surface">
              &ldquo;Technology Partners&rdquo;
            </strong>{" "}
            means third-party companies whose artificial intelligence models,
            APIs, data services, or infrastructure are integrated into the
            Service.
          </li>
        </ul>
      </Section>

      {/* 3 — Account */}
      <Section
        id="account"
        number={3}
        title="Account Registration & Eligibility"
      >
        <p>
          To access certain features of the Service, you must create an account.
          You must be at least eighteen (18) years of age to create an account
          or use the Service. By registering, you represent and warrant that you
          meet this age requirement and that all information you provide is
          accurate, current, and complete.
        </p>
        <p>
          You are responsible for maintaining the confidentiality of your
          account credentials and for all activities that occur under your
          account. You agree to notify us immediately of any unauthorized use of
          your account. We reserve the right to suspend or terminate accounts
          that we reasonably believe have been compromised or are being used in
          violation of these Terms.
        </p>
      </Section>

      {/* 4 — Services */}
      <Section id="services" number={4} title="Description of Services">
        <p>
          PropertyIQ is a real estate analytics platform that provides
          AI-powered market intelligence, proprietary scoring algorithms, data
          visualizations, and analytical tools designed to assist homebuyers,
          real estate investors, and industry professionals in making informed
          real estate decisions. The Service includes, but is not limited to:
        </p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>
            The PropertyIQ Score &mdash; predictive market scoring for
            homebuyers, investors, and agents
          </li>
          <li>AI-generated market reports and analysis</li>
          <li>Market analytics dashboards and reports</li>
          <li>Data integrations from public and proprietary data sources</li>
        </ul>
        <p>
          The Service is provided on an &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo; basis. We reserve the right to modify, suspend, or
          discontinue any part of the Service at any time with or without
          notice.
        </p>
      </Section>

      {/* 5 — AI Disclaimer */}
      <Section id="ai-disclaimer" number={5} title="AI Disclaimer">
        <Callout label="Critical Notice" important>
          <p>
            <strong className="text-on-surface">
              AI-Generated Content may not always be accurate, complete, or
              current. Federal Contracting Services LLC cannot and does not
              guarantee the accuracy, reliability, or completeness of any
              content generated by AI Features, and may not always be able to
              assess its accuracy.
            </strong>
          </p>
        </Callout>
        <p>
          The AI Features of PropertyIQ, including the PropertyIQ Score and all
          scoring and report-generation algorithms, utilize artificial
          intelligence and machine learning technologies that are inherently
          probabilistic in nature. This means that outputs may contain errors,
          inaccuracies, outdated information, or biases that we may not be able
          to detect or correct in real time.
        </p>
        <p>
          AI-Generated Content is provided for{" "}
          <strong className="text-on-surface">
            informational and educational purposes only
          </strong>{" "}
          and should never be relied upon as the sole basis for any real estate
          purchase, investment, financial, or legal decision. You acknowledge
          and agree that:
        </p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>
            AI-Generated Content may contain factual inaccuracies,
            miscalculations, or incomplete analysis.
          </li>
          <li>
            Market data and predictions are inherently uncertain and may not
            reflect current or future market conditions.
          </li>
          <li>
            Scores, ratings, and recommendations are algorithmically derived and
            should be considered as one of many data points in your
            decision-making process.
          </li>
          <li>
            You should independently verify all AI-Generated Content before
            making any decisions based upon it.
          </li>
          <li>
            You should consult qualified professionals (real estate agents,
            financial advisors, attorneys, appraisers) before making significant
            real estate or investment decisions.
          </li>
        </ul>
        <p>
          This disclaimer is also displayed prominently within the PropertyIQ
          product interface.
        </p>
      </Section>

      {/* 6 — AI Role */}
      <Section
        id="ai-role"
        number={6}
        title="Nature of Service; No Professional Advice"
      >
        <Callout label="Critical Legal Notice" important>
          <p>
            PropertyIQ is a{" "}
            <strong className="text-on-surface">
              data aggregation and analytics platform
            </strong>
            . Federal Contracting Services LLC is a technology company that
            provides data, statistical analysis, and algorithmically derived
            insights. We are not, and nothing in the Service shall be construed
            as, a licensed real estate brokerage, appraisal firm, financial
            advisory, investment advisory, tax advisory, or legal practice. No
            content provided through the Service constitutes professional advice
            of any kind.
          </p>
        </Callout>

        <p>
          <strong className="text-on-surface">
            6.1 &mdash; No Professional Relationship.
          </strong>{" "}
          Your use of the Service does not create, and shall not be deemed to
          create, any broker-client, agent-client, advisor-client,
          attorney-client, fiduciary, or other professional-client relationship
          between you and Federal Contracting Services LLC, its officers,
          employees, contractors, or affiliates. No communication through the
          Service, whether generated by AI Features or otherwise, shall give
          rise to any such relationship.
        </p>

        <p>
          <strong className="text-on-surface">
            6.2 &mdash; Nature of Data and Outputs.
          </strong>{" "}
          All data, scores, rankings, projections, estimates, narratives, and
          other outputs provided through the Service are the product of
          automated data aggregation, statistical modeling, and algorithmic
          computation. They are provided for{" "}
          <strong className="text-on-surface">
            informational and educational purposes only
          </strong>
          . You acknowledge and agree that:
        </p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>
            <strong className="text-on-surface">
              PropertyIQ does not act as a real estate agent, broker, or
              salesperson
            </strong>{" "}
            and does not facilitate, negotiate, represent any party in, or
            execute real estate transactions. We hold no real estate licenses
            and do not perform any activities that require licensure under any
            state or federal real estate licensing statute.
          </li>
          <li>
            <strong className="text-on-surface">
              PropertyIQ does not perform real estate appraisals
            </strong>
            . Any property valuations, scores, or price estimates are
            algorithmic outputs based on publicly available data and proprietary
            models. They are not, and shall not be construed as, formal
            appraisals prepared in accordance with the Uniform Standards of
            Professional Appraisal Practice (USPAP) or any applicable state
            appraisal standards.
          </li>
          <li>
            <strong className="text-on-surface">
              PropertyIQ does not provide financial, investment, or tax advice
            </strong>
            . No output of the Service constitutes a recommendation to buy,
            sell, hold, or otherwise transact in any real estate asset or
            security. Federal Contracting Services LLC is not registered as an
            investment adviser under the Investment Advisers Act of 1940 or any
            state securities law, and nothing in the Service shall be construed
            as investment advice within the meaning of such laws.
          </li>
          <li>
            <strong className="text-on-surface">
              PropertyIQ does not provide legal advice or legal opinions
            </strong>
            . No output of the Service constitutes legal counsel, and Federal
            Contracting Services LLC does not engage in the practice of law. You
            should consult a licensed attorney for any legal questions relating
            to real estate transactions, contracts, zoning, land use, fair
            housing compliance, or any other legal matter.
          </li>
        </ul>

        <p>
          <strong className="text-on-surface">
            6.3 &mdash; AI-Generated Statements.
          </strong>{" "}
          Our AI Features, including AI-generated market reports, may generate
          language that could be interpreted as professional advice,
          recommendations, or guidance. You expressly acknowledge and agree that
          any such statements are the product of automated language generation
          and{" "}
          <strong className="text-on-surface">
            do not reflect the professional judgment of any licensed individual
          </strong>
          . Such statements do not alter the nature of the Service as a data
          platform, do not create any professional-client relationship, and
          shall not be relied upon as a substitute for the advice of a
          qualified, licensed professional.
        </p>

        <p>
          <strong className="text-on-surface">
            6.4 &mdash; Duty to Seek Professional Counsel.
          </strong>{" "}
          You agree that before making any real estate purchase, sale,
          investment, financing, or other significant decision informed in whole
          or in part by information obtained through the Service, you will
          consult with appropriately licensed professionals, including but not
          limited to real estate agents or brokers, appraisers, financial
          advisors, tax professionals, and attorneys, as applicable to your
          specific circumstances.
        </p>

        <p>
          <strong className="text-on-surface">
            6.5 &mdash; No Warranty of Suitability.
          </strong>{" "}
          Federal Contracting Services LLC makes no representation or warranty
          that any data, score, analysis, or other output of the Service is
          suitable for any particular purpose, including but not limited to the
          evaluation of specific properties, markets, or investment
          opportunities. All outputs are general in nature and are not tailored
          to your individual financial situation, risk tolerance, or investment
          objectives.
        </p>
      </Section>

      {/* 7 — Acceptable Use */}
      <Section
        id="acceptable-use"
        number={7}
        title='Acceptable Use Policy ("Be a Good Human")'
      >
        <p>
          By using PropertyIQ, you agree to use the Service responsibly and
          lawfully. The following conduct is strictly prohibited:
        </p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>
            Using the AI Features to generate or disseminate false, misleading,
            deceptive, defamatory, or fraudulent content.
          </li>
          <li>
            Using the Service to discriminate against individuals or groups on
            the basis of race, color, religion, sex, national origin, familial
            status, disability, or any other characteristic protected under
            applicable fair housing laws.
          </li>
          <li>
            Attempting to manipulate, reverse-engineer, or extract the
            underlying models, algorithms, or proprietary data of the Service.
          </li>
          <li>
            Using the Service to engage in or facilitate any illegal activity,
            including but not limited to fraud, money laundering, or violations
            of securities laws.
          </li>
          <li>
            Using automated tools, bots, scrapers, or similar mechanisms to
            access the Service beyond the intended user interface and APIs.
          </li>
          <li>
            Impersonating any person, entity, or professional designation while
            using the Service.
          </li>
          <li>
            Harassing, threatening, or abusing other users or Company personnel.
          </li>
          <li>
            Circumventing or attempting to circumvent access controls, usage
            limits, or security features of the Service.
          </li>
          <li>
            Using AI-Generated Content to create spam, misleading real estate
            listings, or deceptive marketing materials.
          </li>
          <li>
            Reselling, sublicensing, or redistributing access to the Service
            without prior written authorization.
          </li>
        </ul>
        <Callout label="Enforcement" important>
          <p>
            Violation of this Acceptable Use Policy may result in immediate
            suspension or permanent termination of your account, at our sole
            discretion, with or without prior notice. We reserve the right to
            report illegal activities to the appropriate law enforcement
            authorities.
          </p>
        </Callout>
      </Section>

      {/* 8 — AI Content */}
      <Section
        id="ai-content"
        number={8}
        title="Restrictions on Sharing & Publishing AI-Generated Content"
      >
        <p>
          You may use AI-Generated Content from PropertyIQ for your personal or
          internal business purposes, subject to the following restrictions:
        </p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>
            <strong className="text-on-surface">No Misrepresentation.</strong>{" "}
            You shall not publish, distribute, or share AI-Generated Content in
            a manner that misrepresents it as human-authored professional
            advice, a formal appraisal, or an official market report.
          </li>
          <li>
            <strong className="text-on-surface">
              No Violation of Use Policy.
            </strong>{" "}
            You shall not use AI-Generated Content in any way that violates the
            Acceptable Use Policy set forth in Section 7.
          </li>
          <li>
            <strong className="text-on-surface">
              Attribution Requirement.
            </strong>{" "}
            If you publish or share AI-Generated Content externally, you must
            clearly indicate that such content was generated by an AI-powered
            tool and should not be treated as professional advice.
          </li>
          <li>
            <strong className="text-on-surface">Full Responsibility.</strong>{" "}
            You assume full and sole responsibility for any AI-Generated Content
            that you publish, share, distribute, or otherwise make available to
            third parties. Federal Contracting Services LLC shall have no
            liability for your use or dissemination of AI-Generated Content.
          </li>
          <li>
            <strong className="text-on-surface">
              Fair Housing Compliance.
            </strong>{" "}
            You shall not use AI-Generated Content in any manner that violates
            the Fair Housing Act or any applicable state or local fair housing
            laws.
          </li>
        </ul>
      </Section>
    </>
  );
}

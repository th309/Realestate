import { Section, Callout } from './TermsComponents';

/** Sections 1–8: Introduction through AI-Generated Content */
export function IntroSections() {
  return (
    <>
      {/* 1 — Introduction */}
      <Section id="introduction" number={1} title="Introduction & Acceptance of Terms">
        <p>
          Welcome to PropertyIQ (
          <a href="https://propertyiq.app" className="text-primary hover:underline">
            https://propertyiq.app
          </a>
          ), a real estate analytics platform owned and operated by{' '}
          <strong className="text-on-surface">Federal Contracting Services LLC</strong>, a Maryland
          limited liability company (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
          &ldquo;our&rdquo;).
        </p>
        <p>
          By accessing or using PropertyIQ, including any associated websites, mobile applications,
          APIs, AI-powered tools, and related services (collectively, the &ldquo;Service&rdquo;), you
          (&ldquo;User,&rdquo; &ldquo;you,&rdquo; or &ldquo;your&rdquo;) agree to be bound by these
          Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to all of these Terms, you must
          not access or use the Service.
        </p>
        <p>
          These Terms constitute a legally binding agreement between you and Federal Contracting
          Services LLC. Please read them carefully. These Terms contain a{' '}
          <strong className="text-on-surface">binding arbitration agreement</strong> and a{' '}
          <strong className="text-on-surface">class action waiver</strong> in Sections 21 and 22 that
          affect your legal rights. By using the Service, you agree to resolve disputes through
          individual arbitration and waive any right to participate in class actions.
        </p>
      </Section>

      {/* 2 — Definitions */}
      <Section id="definitions" number={2} title="Definitions">
        <p>Throughout these Terms, the following definitions apply:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>
            <strong className="text-on-surface">&ldquo;AI Features&rdquo;</strong> means any
            artificial intelligence, machine learning, or algorithmically generated features of the
            Service, including but not limited to Quinn (our AI chatbot), HomeReady scores,
            InvestorEdge scores, market predictions, and any other automated analysis or content
            generation.
          </li>
          <li>
            <strong className="text-on-surface">&ldquo;AI-Generated Content&rdquo;</strong> means any
            text, data, analysis, scores, reports, recommendations, or other output produced in whole
            or in part by the AI Features.
          </li>
          <li>
            <strong className="text-on-surface">&ldquo;User Content&rdquo;</strong> means any data,
            information, text, or materials that you submit, upload, or transmit to the Service.
          </li>
          <li>
            <strong className="text-on-surface">&ldquo;Subscription&rdquo;</strong> means a paid plan
            that grants you access to certain premium features of the Service for a defined period.
          </li>
          <li>
            <strong className="text-on-surface">&ldquo;Technology Partners&rdquo;</strong> means
            third-party companies whose artificial intelligence models, APIs, data services, or
            infrastructure are integrated into the Service.
          </li>
        </ul>
      </Section>

      {/* 3 — Account */}
      <Section id="account" number={3} title="Account Registration & Eligibility">
        <p>
          To access certain features of the Service, you must create an account. You must be at least
          eighteen (18) years of age to create an account or use the Service. By registering, you
          represent and warrant that you meet this age requirement and that all information you provide
          is accurate, current, and complete.
        </p>
        <p>
          You are responsible for maintaining the confidentiality of your account credentials and for
          all activities that occur under your account. You agree to notify us immediately of any
          unauthorized use of your account. We reserve the right to suspend or terminate accounts that
          we reasonably believe have been compromised or are being used in violation of these Terms.
        </p>
      </Section>

      {/* 4 — Services */}
      <Section id="services" number={4} title="Description of Services">
        <p>
          PropertyIQ is a real estate analytics platform that provides AI-powered market intelligence,
          proprietary scoring algorithms, data visualizations, and analytical tools designed to assist
          homebuyers, real estate investors, and industry professionals in making informed real estate
          decisions. The Service includes, but is not limited to:
        </p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>HomeReady&trade; scoring for homebuyers</li>
          <li>InvestorEdge&trade; scoring for real estate investors</li>
          <li>Quinn, an AI-powered real estate chatbot assistant</li>
          <li>Market analytics dashboards and reports</li>
          <li>Data integrations from public and proprietary data sources</li>
        </ul>
        <p>
          The Service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. We
          reserve the right to modify, suspend, or discontinue any part of the Service at any time
          with or without notice.
        </p>
      </Section>

      {/* 5 — AI Disclaimer */}
      <Section id="ai-disclaimer" number={5} title="AI Disclaimer">
        <Callout label="Critical Notice" important>
          <p>
            <strong className="text-on-surface">
              AI-Generated Content may not always be accurate, complete, or current. Federal
              Contracting Services LLC cannot and does not guarantee the accuracy, reliability, or
              completeness of any content generated by AI Features, and may not always be able to
              assess its accuracy.
            </strong>
          </p>
        </Callout>
        <p>
          The AI Features of PropertyIQ, including Quinn and all scoring algorithms, utilize
          artificial intelligence and machine learning technologies that are inherently probabilistic
          in nature. This means that outputs may contain errors, inaccuracies, outdated information,
          or biases that we may not be able to detect or correct in real time.
        </p>
        <p>
          AI-Generated Content is provided for{' '}
          <strong className="text-on-surface">informational and educational purposes only</strong> and
          should never be relied upon as the sole basis for any real estate purchase, investment,
          financial, or legal decision. You acknowledge and agree that:
        </p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>
            AI-Generated Content may contain factual inaccuracies, miscalculations, or incomplete
            analysis.
          </li>
          <li>
            Market data and predictions are inherently uncertain and may not reflect current or future
            market conditions.
          </li>
          <li>
            Scores, ratings, and recommendations are algorithmically derived and should be considered
            as one of many data points in your decision-making process.
          </li>
          <li>
            You should independently verify all AI-Generated Content before making any decisions based
            upon it.
          </li>
          <li>
            You should consult qualified professionals (real estate agents, financial advisors,
            attorneys, appraisers) before making significant real estate or investment decisions.
          </li>
        </ul>
        <p>This disclaimer is also displayed prominently within the PropertyIQ product interface.</p>
      </Section>

      {/* 6 — AI Role */}
      <Section id="ai-role" number={6} title="AI's Role vs. Product's Role">
        <Callout label="Important Distinction">
          <p>
            PropertyIQ is a{' '}
            <strong className="text-on-surface">real estate analytics tool</strong>. It is not a
            licensed real estate broker, appraiser, financial advisor, legal advisor, or investment
            advisor, regardless of what the AI may state during interactions.
          </p>
        </Callout>
        <p>
          Our AI Features, including Quinn, may occasionally self-identify or position themselves in
          ways that could be interpreted as providing professional advice. You acknowledge and agree to
          the following critical distinctions:
        </p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>
            <strong className="text-on-surface">PropertyIQ is not a real estate agent or broker</strong>{' '}
            and does not facilitate, negotiate, or execute real estate transactions.
          </li>
          <li>
            <strong className="text-on-surface">PropertyIQ is not a licensed appraiser</strong> and its
            property valuations and scores are algorithmic estimates, not formal appraisals.
          </li>
          <li>
            <strong className="text-on-surface">PropertyIQ is not a financial or investment advisor</strong>{' '}
            and does not provide personalized financial, tax, or investment advice.
          </li>
          <li>
            <strong className="text-on-surface">PropertyIQ is not a law firm or legal advisor</strong>{' '}
            and does not provide legal advice or legal opinions.
          </li>
          <li>
            Any statements made by the AI that appear to constitute professional advice should be
            understood as informational output of the algorithm and{' '}
            <strong className="text-on-surface">
              not as a substitute for licensed professional counsel
            </strong>
            .
          </li>
        </ul>
        <p>
          If our AI Features make statements that suggest or imply a professional advisory role, those
          statements reflect the AI&apos;s language generation patterns and do not alter the nature of
          the Service or create any professional-client relationship between you and Federal
          Contracting Services LLC.
        </p>
      </Section>

      {/* 7 — Acceptable Use */}
      <Section id="acceptable-use" number={7} title='Acceptable Use Policy ("Be a Good Human")'>
        <p>
          By using PropertyIQ, you agree to use the Service responsibly and lawfully. The following
          conduct is strictly prohibited:
        </p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>
            Using the AI Features to generate or disseminate false, misleading, deceptive, defamatory,
            or fraudulent content.
          </li>
          <li>
            Using the Service to discriminate against individuals or groups on the basis of race,
            color, religion, sex, national origin, familial status, disability, or any other
            characteristic protected under applicable fair housing laws.
          </li>
          <li>
            Attempting to manipulate, reverse-engineer, or extract the underlying models, algorithms,
            or proprietary data of the Service.
          </li>
          <li>
            Using the Service to engage in or facilitate any illegal activity, including but not
            limited to fraud, money laundering, or violations of securities laws.
          </li>
          <li>
            Using automated tools, bots, scrapers, or similar mechanisms to access the Service beyond
            the intended user interface and APIs.
          </li>
          <li>
            Impersonating any person, entity, or professional designation while using the Service.
          </li>
          <li>Harassing, threatening, or abusing other users or Company personnel.</li>
          <li>
            Circumventing or attempting to circumvent access controls, usage limits, or security
            features of the Service.
          </li>
          <li>
            Using AI-Generated Content to create spam, misleading real estate listings, or deceptive
            marketing materials.
          </li>
          <li>
            Reselling, sublicensing, or redistributing access to the Service without prior written
            authorization.
          </li>
        </ul>
        <Callout label="Enforcement" important>
          <p>
            Violation of this Acceptable Use Policy may result in immediate suspension or permanent
            termination of your account, at our sole discretion, with or without prior notice. We
            reserve the right to report illegal activities to the appropriate law enforcement
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
          You may use AI-Generated Content from PropertyIQ for your personal or internal business
          purposes, subject to the following restrictions:
        </p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>
            <strong className="text-on-surface">No Misrepresentation.</strong> You shall not publish,
            distribute, or share AI-Generated Content in a manner that misrepresents it as
            human-authored professional advice, a formal appraisal, or an official market report.
          </li>
          <li>
            <strong className="text-on-surface">No Violation of Use Policy.</strong> You shall not use
            AI-Generated Content in any way that violates the Acceptable Use Policy set forth in
            Section 7.
          </li>
          <li>
            <strong className="text-on-surface">Attribution Requirement.</strong> If you publish or
            share AI-Generated Content externally, you must clearly indicate that such content was
            generated by an AI-powered tool and should not be treated as professional advice.
          </li>
          <li>
            <strong className="text-on-surface">Full Responsibility.</strong> You assume full and sole
            responsibility for any AI-Generated Content that you publish, share, distribute, or
            otherwise make available to third parties. Federal Contracting Services LLC shall have no
            liability for your use or dissemination of AI-Generated Content.
          </li>
          <li>
            <strong className="text-on-surface">Fair Housing Compliance.</strong> You shall not use
            AI-Generated Content in any manner that violates the Fair Housing Act or any applicable
            state or local fair housing laws.
          </li>
        </ul>
      </Section>
    </>
  );
}

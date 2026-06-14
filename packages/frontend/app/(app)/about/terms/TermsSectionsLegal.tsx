import { Section, Callout, ContactCard } from './TermsComponents';

/** Sections 18–26: Limitation of Liability through Contact */
export function LegalSections() {
  return (
    <>
      {/* 18 — Liability */}
      <Section id="liability" number={18} title="Limitation of Liability">
        <Callout label="Legal Notice" important>
          <p>
            Please read this section carefully as it limits the liability of Federal Contracting
            Services LLC and its affiliates.
          </p>
        </Callout>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          18.1 Disclaimer of Warranties
        </h3>
        <p className="uppercase text-xs tracking-wide leading-relaxed">
          The Service, including all AI Features and AI-Generated Content, is provided &ldquo;as
          is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, whether express,
          implied, or statutory. To the fullest extent permitted by applicable law, Federal
          Contracting Services LLC disclaims all warranties, including but not limited to implied
          warranties of merchantability, fitness for a particular purpose, accuracy, completeness,
          non-infringement, and any warranties arising from course of dealing or usage of trade.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          18.2 Limitation of Damages
        </h3>
        <p className="uppercase text-xs tracking-wide leading-relaxed">
          To the maximum extent permitted by applicable law, in no event shall Federal Contracting
          Services LLC, its officers, directors, members, employees, agents, or licensors be liable
          for any indirect, incidental, special, consequential, or punitive damages, including without
          limitation damages for loss of profits, goodwill, data, or other intangible losses, arising
          out of or related to:
        </p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>Your use of or inability to use the Service;</li>
          <li>
            Any AI-Generated Content, including any errors, inaccuracies, or omissions therein;
          </li>
          <li>
            Any real estate, investment, financial, or other decisions made in reliance on the Service
            or AI-Generated Content;
          </li>
          <li>Unauthorized access to or alteration of your transmissions or data;</li>
          <li>Any conduct or content of any third party on the Service;</li>
          <li>Any actions taken or not taken by Technology Partners; or</li>
          <li>Any other matter relating to the Service.</li>
        </ul>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          18.3 Cap on Liability
        </h3>
        <p className="uppercase text-xs tracking-wide leading-relaxed">
          To the maximum extent permitted by applicable law, the total aggregate liability of Federal
          Contracting Services LLC arising out of or relating to these Terms or the Service shall not
          exceed the greater of (a) the total amount you paid to us in the twelve (12) months
          preceding the event giving rise to the claim, or (b) one hundred dollars ($100.00 USD).
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          18.4 Essential Basis
        </h3>
        <p>
          The limitations set forth in this Section 18 reflect a fair allocation of risk and form an
          essential basis of the bargain between you and Federal Contracting Services LLC. The Service
          would not be provided without these limitations.
        </p>
      </Section>

      {/* 19 — Indemnification */}
      <Section id="indemnification" number={19} title="Indemnification">
        <p>
          You agree to indemnify, defend, and hold harmless Federal Contracting Services LLC, its
          officers, directors, members, employees, agents, and licensors from and against any and all
          claims, damages, losses, liabilities, costs, and expenses (including reasonable
          attorneys&apos; fees) arising out of or relating to:
        </p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>Your use of the Service or AI-Generated Content;</li>
          <li>Your violation of these Terms or any applicable law or regulation;</li>
          <li>Your publication, distribution, or sharing of AI-Generated Content;</li>
          <li>Any User Content you submit to the Service;</li>
          <li>Your violation of any third-party rights; or</li>
          <li>Any dispute between you and a third party arising from your use of the Service.</li>
        </ul>
      </Section>

      {/* 20 — Legal Restrictions */}
      <Section id="legal-restrictions" number={20} title="Legal & Export Restrictions">
        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          20.1 Geographic Availability
        </h3>
        <p>
          The Service is designed for and primarily directed at users within the United States. While
          access may be available from other jurisdictions, we make no representation that the Service
          is appropriate, available, or compliant with laws outside of the United States. If you access
          the Service from outside the United States, you do so at your own risk and are solely
          responsible for compliance with your local laws.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">20.2 Export Controls</h3>
        <p>
          The Service may be subject to United States export control laws and regulations, including
          the Export Administration Regulations (EAR) administered by the U.S. Department of Commerce.
          You agree not to export, re-export, or transfer the Service or any technical data received
          through the Service, directly or indirectly, in violation of any applicable export laws or
          regulations.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          20.3 Sanctions Compliance
        </h3>
        <p>
          You represent and warrant that you are not located in, under the control of, or a national
          or resident of any country subject to comprehensive U.S. economic sanctions (currently
          including Cuba, Iran, North Korea, Syria, and the Crimea, Donetsk, and Luhansk regions of
          Ukraine), and that you are not designated on any U.S. government list of prohibited or
          restricted parties, including the Specially Designated Nationals List maintained by the
          Office of Foreign Assets Control (OFAC).
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          20.4 Regulatory Compliance
        </h3>
        <p>
          You are solely responsible for ensuring that your use of the Service complies with all
          applicable federal, state, and local laws and regulations, including but not limited to the
          Fair Housing Act, the Real Estate Settlement Procedures Act (RESPA), state real estate
          licensing laws, and applicable data protection laws.
        </p>
      </Section>

      {/* 21 — Arbitration */}
      <Section id="arbitration" number={21} title="Binding Arbitration Agreement">
        <Callout label="Important — Please Read Carefully" important>
          <p>
            This section contains a binding arbitration agreement. By agreeing to these Terms, you and
            Federal Contracting Services LLC are each waiving the right to a trial by jury and the
            right to participate in a class action.
          </p>
        </Callout>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          21.1 Agreement to Arbitrate
        </h3>
        <p>
          You and Federal Contracting Services LLC mutually agree that any dispute, claim, or
          controversy arising out of or relating to these Terms, the Service, AI-Generated Content,
          your account, or the relationship between you and Federal Contracting Services LLC
          (collectively, &ldquo;Disputes&rdquo;) shall be resolved exclusively through final and
          binding individual arbitration, rather than in court, except as set forth in Section 21.4
          below.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          21.2 Arbitration Rules &amp; Procedures
        </h3>
        <p>
          Arbitration shall be administered by the American Arbitration Association
          (&ldquo;AAA&rdquo;) under its Consumer Arbitration Rules then in effect, which are available
          at{' '}
          <a
            href="https://www.adr.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            www.adr.org
          </a>
          . If the AAA is unavailable or unable to administer the arbitration, the parties shall agree
          on an alternative arbitration forum; if no agreement can be reached, either party may
          petition a court of competent jurisdiction to appoint an arbitrator.
        </p>
        <p>
          The arbitration shall be conducted by a single arbitrator with relevant experience. The
          arbitrator shall have the authority to grant any remedy that would be available in a court of
          competent jurisdiction, including injunctive or declaratory relief, but only to the extent
          required to satisfy your individual claim.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          21.3 Location &amp; Procedure
        </h3>
        <p>
          The arbitration shall be conducted in the English language. Unless you and Federal
          Contracting Services LLC agree otherwise, or the applicable AAA rules provide otherwise, the
          arbitration shall take place in Baltimore City, Maryland. For claims of $25,000 or less, you
          may choose whether the arbitration will be conducted solely on the basis of written
          submissions, through a telephonic or video conference hearing, or by an in-person hearing.
          The arbitrator&apos;s decision shall be final and binding and may be entered as a judgment in
          any court of competent jurisdiction.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          21.4 Exceptions to Arbitration
        </h3>
        <p>
          Notwithstanding the foregoing, the following Disputes are excluded from this arbitration
          agreement:
        </p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>Claims that may be brought in small claims court, if your claims qualify;</li>
          <li>
            Actions seeking injunctive or other equitable relief for the alleged unlawful use of
            intellectual property (including copyrights, trademarks, trade names, logos, trade secrets,
            or patents);
          </li>
          <li>
            Any claim where arbitration is prohibited by applicable law that cannot be waived.
          </li>
        </ul>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          21.5 Arbitration Fees &amp; Costs
        </h3>
        <p>
          Payment of all filing, administration, and arbitrator fees will be governed by the
          AAA&apos;s applicable Consumer Arbitration Rules. If your claim is for $75,000 or less,
          Federal Contracting Services LLC will pay all filing, administration, and arbitrator fees. If
          the arbitrator finds that your claim was frivolous or brought in bad faith, the arbitrator
          may reallocate fees in accordance with the AAA rules. Each party shall bear its own
          attorneys&apos; fees and costs unless the arbitrator awards fees and costs to the prevailing
          party where authorized by applicable law.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          21.6 Informal Resolution First
        </h3>
        <p>
          Before initiating arbitration, you agree to first attempt to resolve the Dispute informally
          by contacting us at{' '}
          <a href="mailto:info@propertyiq.app" className="text-primary hover:underline">
            info@propertyiq.app
          </a>
          . We will attempt to resolve the Dispute informally within sixty (60) days. If the Dispute
          is not resolved within sixty (60) days of receipt of your written notice, either party may
          proceed to arbitration.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          21.7 Opt-Out Right
        </h3>
        <p>
          You have the right to opt out of this binding arbitration agreement by sending written notice
          of your decision to opt out to{' '}
          <a href="mailto:info@propertyiq.app" className="text-primary hover:underline">
            info@propertyiq.app
          </a>{' '}
          or to the Company&apos;s registered agent address within thirty (30) days of first accepting
          these Terms. Your notice must include your name, account email address, mailing address, and
          a clear statement that you wish to opt out of the arbitration agreement. If you opt out, the
          remaining provisions of these Terms will continue to apply.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          21.8 Severability of Arbitration Provisions
        </h3>
        <p>
          If any portion of this arbitration agreement is found to be unenforceable or unlawful, the
          unenforceable provision shall be severed, and the remaining arbitration terms shall be
          enforced. However, if the Class Action Waiver in Section 22 is found to be unenforceable as
          to a particular claim for relief, then the entirety of this arbitration agreement shall be
          deemed void as to that claim only.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">21.9 Survival</h3>
        <p>
          This arbitration agreement shall survive termination of your account, cancellation of your
          subscription, and any amendment to these Terms (unless the amendment specifically states
          otherwise and you affirmatively consent to the amendment).
        </p>
      </Section>

      {/* 22 — Class Action Waiver */}
      <Section id="class-action-waiver" number={22} title="Class Action Waiver">
        <Callout label="Waiver of Class Proceedings" important>
          <p className="uppercase text-xs tracking-wide leading-relaxed">
            <strong>
              You and Federal Contracting Services LLC agree that each may bring claims against the
              other only in your or its individual capacity and not as a plaintiff or class member in
              any purported class, consolidated, multi-party, or representative proceeding.
            </strong>
          </p>
        </Callout>
        <p>
          Unless both you and Federal Contracting Services LLC agree otherwise in writing, the
          arbitrator may not consolidate more than one person&apos;s claims and may not otherwise
          preside over any form of a representative, class, or multi-party proceeding. The arbitrator
          may award relief (including monetary, injunctive, and declaratory relief) only in favor of
          the individual party seeking relief and only to the extent necessary to provide relief
          warranted by that party&apos;s individual claim. Any relief awarded cannot affect other
          users.
        </p>
      </Section>

      {/* 23 — Termination */}
      <Section id="termination" number={23} title="Termination">
        <p>
          We may suspend or terminate your access to the Service immediately, without prior notice or
          liability, for any reason whatsoever, including without limitation if you breach these Terms
          or the Acceptable Use Policy.
        </p>
        <p>
          Upon termination: (a) your right to use the Service will immediately cease; (b) we may
          delete or restrict access to your account and associated data in accordance with our Privacy
          Policy; and (c) any provisions of these Terms that by their nature should survive
          termination shall survive, including but not limited to Sections 5, 8, 9, 12, 18, 19, 21,
          22, and 24.
        </p>
      </Section>

      {/* 24 — Governing Law */}
      <Section id="governing-law" number={24} title="Governing Law">
        <p>
          These Terms and any disputes arising hereunder shall be governed by and construed in
          accordance with the laws of the State of Maryland, without regard to its conflict of law
          principles. To the extent that litigation is permitted under these Terms (for matters
          excluded from arbitration), you consent to the exclusive jurisdiction and venue of the state
          and federal courts located in Baltimore City, Maryland.
        </p>
      </Section>

      {/* 25 — Changes */}
      <Section id="changes" number={25} title="Changes to These Terms">
        <p>
          Federal Contracting Services LLC reserves the right to modify or replace these Terms at any
          time at our sole discretion. If we make material changes, we will provide at least thirty
          (30) days&apos; notice prior to the new terms taking effect by posting the revised Terms on
          the Service and, where feasible, notifying you via email or in-app notification.
        </p>
        <p>
          Your continued use of the Service after the effective date of revised Terms constitutes your
          acceptance of the changes. If you do not agree to the revised Terms, you must stop using the
          Service and cancel your subscription.
        </p>
        <p>
          Non-material changes (such as typographical corrections or clarifications) may be made
          without prior notice. The &ldquo;Effective Date&rdquo; at the top of these Terms indicates
          when the most recent material revision took effect.
        </p>
      </Section>

      {/* 26 — Contact */}
      <Section id="contact" number={26} title="Contact Information">
        <p>
          If you have questions, concerns, or feedback regarding these Terms of Service, the Service,
          or any matter described herein, please contact us through any of the following channels:
        </p>
        <ContactCard />
        <p>
          For billing disputes, refund requests, cancellation assistance, and general support, please
          direct correspondence to{' '}
          <a href="mailto:info@propertyiq.app" className="text-primary hover:underline">
            info@propertyiq.app
          </a>
          . For legal notices, arbitration demands, and opt-out requests, correspondence may also be
          sent to the registered agent address above.
        </p>
      </Section>
    </>
  );
}

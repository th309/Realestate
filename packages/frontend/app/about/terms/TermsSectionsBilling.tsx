import { Section } from './TermsComponents';

/** Sections 13–17: Subscriptions through Promotions */
export function BillingSections() {
  return (
    <>
      {/* 13 — Subscriptions */}
      <Section id="subscriptions" number={13} title="Subscriptions & Billing">
        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          13.1 Subscription Plans
        </h3>
        <p>
          PropertyIQ offers both free and paid subscription tiers. Paid subscriptions provide access
          to premium features, enhanced data, and expanded usage limits as described on our pricing
          page. Subscription features and pricing are subject to change; we will provide reasonable
          advance notice of material changes.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">13.2 Billing</h3>
        <p>
          Paid subscriptions are billed in advance on a recurring basis (monthly or annually,
          depending on your selected plan). By subscribing, you authorize Federal Contracting Services
          LLC to charge your designated payment method at the beginning of each billing cycle.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">13.3 Taxes</h3>
        <p>
          All fees are exclusive of applicable taxes, levies, or duties. You are responsible for
          paying all such taxes associated with your subscription, excluding taxes based on our net
          income.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">13.4 Price Changes</h3>
        <p>
          We reserve the right to adjust subscription pricing. Any price changes will take effect at
          the start of your next billing cycle following at least thirty (30) days&apos; written
          notice. Your continued use of the Service after a price change constitutes your acceptance
          of the new pricing.
        </p>
      </Section>

      {/* 14 — Refund & Dispute */}
      <Section id="refund-dispute" number={14} title="Refund & Dispute Policy">
        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          14.1 Refund Eligibility
        </h3>
        <p>
          Because PropertyIQ is a digital services platform and access to premium features is granted
          immediately upon payment, refunds are generally not available. However, we may consider
          refund requests on a case-by-case basis under the following circumstances:
        </p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>
            <strong className="text-on-surface">Technical Failure:</strong> The Service was materially
            unavailable or non-functional for a sustained period during your billing cycle due to an
            issue on our end.
          </li>
          <li>
            <strong className="text-on-surface">Billing Error:</strong> You were charged in error,
            charged an incorrect amount, or charged after valid cancellation.
          </li>
          <li>
            <strong className="text-on-surface">First Billing Cycle:</strong> You are within seven (7)
            calendar days of your initial paid subscription purchase and have not made substantial use
            of premium features.
          </li>
        </ul>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">14.2 Refund Process</h3>
        <p>
          To request a refund, contact our customer service team at{' '}
          <a href="mailto:info@propertyiq.app" className="text-primary hover:underline">
            info@propertyiq.app
          </a>{' '}
          with the subject line &ldquo;Refund Request&rdquo; and include your account email,
          subscription details, and the reason for your request. We will acknowledge your request
          within three (3) business days and provide a determination within ten (10) business days.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">14.3 Disputes</h3>
        <p>
          If you dispute a charge, please contact us at{' '}
          <a href="mailto:info@propertyiq.app" className="text-primary hover:underline">
            info@propertyiq.app
          </a>{' '}
          before initiating a dispute with your payment provider. We are committed to resolving
          billing issues promptly and in good faith. Initiating a chargeback without first contacting
          us may result in suspension of your account pending resolution.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          14.4 Approved Refunds
        </h3>
        <p>
          Approved refunds will be credited to the original payment method within ten (10) to fifteen
          (15) business days of approval. Refunds are prorated based on the unused portion of your
          billing cycle unless otherwise determined.
        </p>
      </Section>

      {/* 15 — Cancellation */}
      <Section id="cancellation" number={15} title="Cancellation Policy">
        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">15.1 How to Cancel</h3>
        <p>
          You may cancel your paid subscription at any time through your account settings or by
          contacting us at{' '}
          <a href="mailto:info@propertyiq.app" className="text-primary hover:underline">
            info@propertyiq.app
          </a>
          . Cancellation is effective at the end of your current billing cycle.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          15.2 Effect of Cancellation
        </h3>
        <p>
          Upon cancellation, you will continue to have access to paid features through the end of your
          current billing cycle. After that period, your account will revert to the free tier and you
          will lose access to premium features. Data associated with premium features may be retained
          for a reasonable period to allow for re-subscription, after which it may be deleted in
          accordance with our Privacy Policy.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">
          15.3 No Partial Refunds
        </h3>
        <p>
          Unless otherwise specified in Section 14, cancellation does not entitle you to a refund for
          the remaining portion of a billing cycle. Annual subscribers who cancel mid-term will retain
          access through the end of the annual period.
        </p>

        <h3 className="text-base font-semibold text-on-surface mt-6 mb-2">15.4 Reactivation</h3>
        <p>
          If you wish to reactivate your subscription after cancellation, you may do so through your
          account settings. Reactivation may be subject to current pricing, which may differ from your
          prior subscription rate.
        </p>
      </Section>

      {/* 16 — Return Policy */}
      <Section id="return-policy" number={16} title="Return Policy (Physical Goods)">
        <p>
          PropertyIQ is primarily a digital services platform. However, in the event that we offer
          physical goods (such as branded merchandise, printed reports, or hardware devices) either
          directly or through our platform, the following return policy applies:
        </p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>
            <strong className="text-on-surface">Eligibility:</strong> Physical goods may be returned
            within thirty (30) days of delivery, provided they are in unused, original condition with
            all packaging and documentation.
          </li>
          <li>
            <strong className="text-on-surface">Non-Returnable Items:</strong> Custom-printed reports,
            personalized items, and items marked as final sale are not eligible for return.
          </li>
          <li>
            <strong className="text-on-surface">Process:</strong> To initiate a return, contact{' '}
            <a href="mailto:info@propertyiq.app" className="text-primary hover:underline">
              info@propertyiq.app
            </a>{' '}
            with your order number and reason for return. We will provide a return authorization and
            shipping instructions.
          </li>
          <li>
            <strong className="text-on-surface">Shipping Costs:</strong> Return shipping costs are the
            responsibility of the purchaser unless the return is due to a defect or shipping error on
            our part.
          </li>
          <li>
            <strong className="text-on-surface">Refund for Returns:</strong> Refunds for returned
            physical goods will be processed within fifteen (15) business days of receiving the
            returned item.
          </li>
        </ul>
      </Section>

      {/* 17 — Promotions */}
      <Section id="promotions" number={17} title="Terms & Conditions of Promotions">
        <p>
          From time to time, Federal Contracting Services LLC may offer promotional pricing, free
          trials, referral programs, discount codes, or other special offers
          (&ldquo;Promotions&rdquo;) in connection with the Service. All Promotions are subject to the
          following general terms:
        </p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>
            <strong className="text-on-surface">Eligibility:</strong> Promotions may be limited to new
            users, specific subscription tiers, geographic regions, or other qualifying criteria as
            specified in the applicable promotional materials.
          </li>
          <li>
            <strong className="text-on-surface">Duration:</strong> All Promotions have a defined
            expiration date and must be redeemed prior to that date. Expired Promotions will not be
            honored.
          </li>
          <li>
            <strong className="text-on-surface">Non-Transferable:</strong> Unless otherwise stated,
            Promotions are non-transferable and may not be sold, bartered, or combined with other
            offers.
          </li>
          <li>
            <strong className="text-on-surface">Limit:</strong> Unless otherwise stated, Promotions
            are limited to one per user, per household, or per account.
          </li>
          <li>
            <strong className="text-on-surface">Auto-Renewal:</strong> Subscriptions initiated through
            a free trial or promotional pricing will automatically renew at the then-current standard
            subscription rate at the conclusion of the promotional period unless cancelled prior to
            renewal.
          </li>
          <li>
            <strong className="text-on-surface">Modification or Cancellation:</strong> We reserve the
            right to modify, suspend, or cancel any Promotion at any time for any reason, including in
            cases of suspected fraud or abuse, without liability to you.
          </li>
          <li>
            <strong className="text-on-surface">Tax Liability:</strong> You are solely responsible for
            any tax obligations arising from participation in a Promotion.
          </li>
        </ul>
        <p>
          Specific terms for individual Promotions will be provided at the time of the offer and will
          supplement these general terms. In the event of a conflict, the specific promotional terms
          will control.
        </p>
      </Section>
    </>
  );
}

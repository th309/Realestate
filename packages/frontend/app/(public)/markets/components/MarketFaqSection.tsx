import { FaqSection } from "@/app/components/seo/FaqSection";
import type { MarketFaq } from "./build-market-faqs";

/**
 * Server-rendered FAQ block for market pages (metro / county / ZIP), forecast
 * pages, and any other caller passing pre-built MarketFaq[]. Thin wrapper
 * around the shared FaqSection — kept as its own file/name since callers
 * across markets/ and forecast/ already import it by this name.
 */
export function MarketFaqSection({ faqs }: { faqs: MarketFaq[] }) {
  return <FaqSection faqs={faqs} />;
}

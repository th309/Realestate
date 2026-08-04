import { Sparkles } from "lucide-react";
import { Section, SectionHeading } from "@/app/components/marketing";

/**
 * Homepage testimonials band — four attributed quotes in a two-column grid.
 *
 * Fully static, so this stays a server component.
 *
 * The MCP quote leads and is the only card carrying a lead tag: it is the one
 * testimonial about the capability no competitor has, so it earns the emphasis
 * the other three don't. Each quote is marked up as a real `<figure>` /
 * `<blockquote>` / `<figcaption>` — these are attributed quotations and the
 * semantics are the point. The `<q>` element is deliberately avoided because it
 * injects quotation marks in some engines.
 */

type Testimonial = {
  quote: string;
  name: string;
  role: string;
  /** Only the lead card carries a tag. */
  tag?: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "What sold me wasn't the dashboard, it was hooking PropertyIQ into Claude through MCP. I can ask for a full market breakdown, migration trends, rent-to-price ratios, economic indicators, and get back a detailed narrative instead of a pile of raw numbers I have to interpret myself. It's like having a research analyst on call.",
    name: "Jordan K.",
    role: "Real Estate Investor & Data Nerd",
    tag: "Why they switched",
  },
  {
    quote:
      "I used to spend hours cross-referencing Zillow, Census data, and spreadsheets before making an offer. Now I pull up a market's PropertyIQ Score and know in seconds whether it fits my buy-and-hold strategy. The deal grading caught a flip I almost overpaid for. This tool paid for itself on the first deal.",
    name: "Marcus T.",
    role: "Real Estate Investor · Charlotte, NC",
  },
  {
    quote:
      "My clients expect data, not just gut feelings. PropertyIQ lets me generate a buyer consultation brief in minutes — market comps, price trends, neighborhood scores, all in one clean report I can hand straight to a client. It's made me look sharper in every listing presentation.",
    name: "Dana R.",
    role: "Broker Associate · Austin, TX",
  },
  {
    quote:
      "The A to F deal grading is what sold me. I can run a property through the Deal Analyzer and immediately see if the numbers work for a BRRRR or a flip — cash on cash, cap rate, the whole picture. I stopped guessing and started closing deals I can actually defend to my lender.",
    name: "Chris L.",
    role: "BRRRR Investor · Columbus, OH",
  },
];

export function Testimonials() {
  return (
    <Section surface="b">
      <SectionHeading title="What investors and agents are saying" />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {TESTIMONIALS.map((testimonial) => (
          <figure
            key={testimonial.name}
            className="flex flex-col gap-6 rounded-xl border border-outline-variant bg-surface p-8"
          >
            {testimonial.tag ? (
              <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-primary-container px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-on-primary-container">
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                {testimonial.tag}
              </span>
            ) : null}

            <blockquote className="text-base italic leading-[1.62] text-on-surface-variant">
              {testimonial.quote}
            </blockquote>

            {/* No avatar. The mockup drew an initials disc, but a disc where a
                face belongs reads as a photo that failed to load. The name and
                role carry the attribution on their own. */}
            <figcaption className="mt-auto flex flex-col">
              <span className="text-[15px] font-bold text-on-surface">
                {testimonial.name}
              </span>
              <span className="text-[13.5px] text-on-surface-variant">
                {testimonial.role}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}

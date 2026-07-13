import { PromptBubble } from "./PromptBubble";

export function ClosingCta() {
  return (
    <section className="max-w-2xl mx-auto px-6 py-16">
      <div className="rounded-[28px] bg-inverse-surface text-inverse-on-surface px-8 py-14 text-center">
        <h2 className="text-2xl md:text-3xl font-semibold text-balance">
          Your next deal starts with a message
        </h2>

        <div className="mt-6">
          <PromptBubble prompt="What's the PropertyIQ score for Austin, TX?" />
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href="#install"
            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#1A237E] shadow-md hover:bg-white/90 hover:shadow-lg transition-all duration-200"
          >
            Connect now
          </a>
          <a
            href="/docs/mcp/reference"
            className="text-sm font-medium text-inverse-on-surface/70 hover:text-inverse-on-surface hover:underline"
          >
            See the full docs
          </a>
        </div>
      </div>
    </section>
  );
}

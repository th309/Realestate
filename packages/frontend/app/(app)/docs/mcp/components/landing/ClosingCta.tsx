import { PromptBubble } from "./PromptBubble";

export function ClosingCta() {
  return (
    <section className="max-w-2xl mx-auto px-6 py-16 text-center">
      <h2 className="text-2xl md:text-3xl font-semibold text-on-surface text-balance">
        Your next deal starts with a message
      </h2>

      <div className="mt-6">
        <PromptBubble prompt="What's the PropertyIQ score for Austin, TX?" />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <a
          href="#install"
          className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-on-primary shadow-sm hover:bg-primary/90 transition-colors duration-200"
        >
          Connect now
        </a>
        <a
          href="/docs/mcp/reference"
          className="text-sm font-medium text-on-surface-variant hover:text-on-surface hover:underline"
        >
          See the full docs
        </a>
      </div>
    </section>
  );
}

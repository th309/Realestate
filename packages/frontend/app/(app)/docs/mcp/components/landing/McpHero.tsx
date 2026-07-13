/**
 * Hero's signature moment: an actual recorded Claude.ai session asking
 * PropertyIQ a real market question and getting a live MCP tool response
 * back — dramatizing what "connect PropertyIQ to Claude" actually gets
 * you, before any install instructions appear.
 */
export function McpHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#1A237E] via-[#3949AB] via-30% to-surface">
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-14 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-container px-3 py-1 text-xs font-mono font-medium uppercase tracking-wide text-on-primary-container">
          MCP Integration · 44 tools
        </span>

        <h1 className="mt-5 text-4xl md:text-5xl font-bold text-white tracking-tight text-balance">
          Add PropertyIQ to Claude
        </h1>

        <p className="mt-4 text-lg text-[#C5CAE9] text-balance">
          Win listings, prep buyer consultations, and answer any market question
          — live PropertyIQ data, right inside your AI assistant.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href="#install"
            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#1A237E] shadow-md hover:bg-white/90 hover:shadow-lg transition-all duration-200"
          >
            Connect now
          </a>
          <a
            href="/docs/mcp/reference"
            className="text-sm font-medium text-white/90 hover:text-white hover:underline"
          >
            Browse all 44 tools →
          </a>
        </div>

        <div className="mt-12 rounded-xl overflow-hidden shadow-xl border border-white/10 bg-surface">
          <video
            autoPlay
            muted
            loop
            playsInline
            poster="/videos/mcp-demo-poster.png"
            className="w-full h-auto block"
            style={{ aspectRatio: "690 / 484" }}
            aria-label="Recorded Claude.ai session asking PropertyIQ for the score of Austin, TX, and receiving a live PropertyIQ score with market context"
          >
            <source src="/videos/mcp-demo.webm" type="video/webm" />
            <source src="/videos/mcp-demo.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
    </section>
  );
}

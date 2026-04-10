const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Inlined from ScoreDisplay — that module is "use client" and can't be
// called from a Server Component.
function getScoreColor(value: number): string {
  const percentage = Math.min(Math.max(value / 100, 0), 1);
  const hue = percentage * 120;
  return `hsl(${hue}, 100%, 50%)`;
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "EXCELLENT";
  if (score >= 80) return "GREAT";
  if (score >= 70) return "GOOD";
  if (score >= 60) return "FAIR";
  if (score >= 50) return "AVERAGE";
  if (score >= 40) return "BELOW AVG";
  if (score >= 20) return "POOR";
  return "VERY POOR";
}

interface MarketScore {
  location_id: string;
  location_name: string;
  score: number;
  grade: string;
}

async function fetchTopScores(sort: "asc" | "desc"): Promise<MarketScore[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/scores/top?geography=metro&score_type=propertyiq&limit=5&sort=${sort}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function ScoreRow({ market }: { market: MarketScore }) {
  const color = getScoreColor(market.score);
  const label = getScoreLabel(market.score);

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#C5CAE9]/30 last:border-0">
      <span className="text-sm text-[#1A237E] font-medium truncate mr-4">
        {market.location_name}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-[#3949AB] uppercase tracking-wide">
          {label}
        </span>
        <span
          className="font-[family-name:var(--font-roboto-mono)] text-sm font-bold w-8 text-center rounded-md px-1.5 py-0.5"
          style={{ color, textShadow: "0 0 1px rgba(0,0,0,0.1)" }}
        >
          {market.score}
        </span>
      </div>
    </div>
  );
}

export async function ScoreTeaser() {
  const [hottest, coldest] = await Promise.all([
    fetchTopScores("desc"),
    fetchTopScores("asc"),
  ]);

  if (hottest.length === 0 && coldest.length === 0) return null;

  return (
    <section
      className="py-14 lg:py-20 px-6"
      aria-labelledby="score-teaser-heading"
    >
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <span className="text-xs font-semibold text-[#3949AB] uppercase tracking-[0.15em] mb-3 block">
            Live Data
          </span>
          <h2
            id="score-teaser-heading"
            className="text-2xl md:text-3xl font-bold text-[#1A237E] tracking-tight leading-tight font-[family-name:var(--font-source-serif)]"
          >
            The hottest — and coldest — markets right now.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="rounded-2xl bg-white/80 border border-[#C5CAE9] p-6">
            <h3 className="text-sm font-semibold text-[#3949AB] uppercase tracking-wide mb-3">
              Hottest Markets
            </h3>
            {hottest.map((m) => (
              <ScoreRow key={m.location_id} market={m} />
            ))}
          </div>

          <div className="rounded-2xl bg-white/80 border border-[#C5CAE9] p-6">
            <h3 className="text-sm font-semibold text-[#3949AB] uppercase tracking-wide mb-3">
              Coldest Markets
            </h3>
            {coldest.map((m) => (
              <ScoreRow key={m.location_id} market={m} />
            ))}
          </div>
        </div>

        <div className="text-center">
          <a
            href="/markets"
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#3949AB] hover:text-[#1A237E] transition-colors group"
          >
            See all 925 metros
            <span
              className="transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            >
              →
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}

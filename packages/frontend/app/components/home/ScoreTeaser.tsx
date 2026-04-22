import { CBSA_TO_METRO } from "@/lib/data/metro-slug-data";
import { ScoreTeaserRow } from "./ScoreTeaserRow";

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

function resolveMetroHref(cbsaCode: string): string {
  const metro = CBSA_TO_METRO.get(cbsaCode);
  return metro ? `/markets/${metro.slug}` : `/map?geo=metro&id=${cbsaCode}`;
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
          <span className="text-xs font-semibold text-[#C5CAE9] uppercase tracking-[0.15em] mb-3 block">
            Live Data
          </span>
          <h2
            id="score-teaser-heading"
            className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-tight font-[family-name:var(--font-source-serif)]"
          >
            The hottest — and coldest — markets right now.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
            <h3 className="text-sm font-semibold text-[#C5CAE9] uppercase tracking-wide mb-3">
              Hottest Markets
            </h3>
            {hottest.map((m, i) => (
              <ScoreTeaserRow
                key={m.location_id}
                rank={i + 1}
                geoLevel="metro"
                geoId={m.location_id}
                name={m.location_name}
                score={m.score}
                hotOrCold="hot"
                href={resolveMetroHref(m.location_id)}
                label={getScoreLabel(m.score)}
                color={getScoreColor(m.score)}
              />
            ))}
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
            <h3 className="text-sm font-semibold text-[#C5CAE9] uppercase tracking-wide mb-3">
              Coldest Markets
            </h3>
            {coldest.map((m, i) => (
              <ScoreTeaserRow
                key={m.location_id}
                rank={i + 1}
                geoLevel="metro"
                geoId={m.location_id}
                name={m.location_name}
                score={m.score}
                hotOrCold="cold"
                href={resolveMetroHref(m.location_id)}
                label={getScoreLabel(m.score)}
                color={getScoreColor(m.score)}
              />
            ))}
          </div>
        </div>

        <div className="text-center">
          <a
            href="/markets"
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#C5CAE9] hover:text-white transition-colors group"
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

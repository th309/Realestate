import type { Metadata } from "next";
import Link from "next/link";
import { WebPageJsonLd } from "@/app/components/seo/WebPageJsonLd";

const PAGE_URL = "https://www.propertyiq.app/reports/q2-2026-by-state";

export const metadata: Metadata = {
  title:
    "PropertyIQ Q2 2026: Best Real Estate Market in Every State | PropertyIQ",
  description:
    "See the top-ranked real estate market in all 50 states, scored by PropertyIQ Score for Q2 2026. Data-driven market rankings updated quarterly.",
  keywords: [
    "best real estate market in every state 2026",
    "PropertyIQ Score Q2 2026",
    "top real estate markets by state",
    "best housing markets 2026",
    "real estate market rankings 2026",
  ],
  alternates: { canonical: PAGE_URL },
  robots: { index: true, follow: true },
  openGraph: {
    type: "article",
    title: "PropertyIQ Q2 2026: Best Real Estate Market in Every State",
    description:
      "The top-ranked real estate market in all 50 states for Q2 2026, scored and ranked by the PropertyIQ Score. See which markets lead in your state.",
    url: PAGE_URL,
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ Q2 2026 Best Real Estate Market in Every State",
      },
    ],
    publishedTime: "2026-04-11T00:00:00Z",
  },
  twitter: {
    card: "summary_large_image",
    title: "PropertyIQ Q2 2026: Best Real Estate Market in Every State",
    description:
      "Top-ranked real estate market in all 50 states for Q2 2026. PropertyIQ Score data, updated quarterly.",
  },
};

// Markets with confirmed /markets/[slug] routes for internal linking
const TOP_MARKET_SLUGS: Record<string, string> = {
  "San Francisco, CA": "san-francisco-oakland-fremont-ca",
  "North Platte, NE": "north-platte-ne",
  "Rochester, NY": "rochester-ny",
  "Norwich, CT": "norwich-new-london-willimantic-ct",
  "Manchester, NH": "manchester-nashua-nh",
  "Oak Harbor, WA": "oak-harbor-wa",
  "Springfield, MA": "springfield-ma",
  "Los Alamos, NM": "los-alamos-nm",
  "Lancaster, PA": "lancaster-pa",
  "Providence, RI": "providence-warwick-ri-ma",
  "Milwaukee, WI": "milwaukee-waukesha-wi",
  "Grand Rapids, MI": "grand-rapids-wyoming-kentwood-mi",
  "Richmond, VA": "richmond-va",
  "Baltimore, MD": "baltimore-columbia-towson-md",
  "St. Louis, MO": "st-louis-mo-il",
};

interface MarketRow {
  rank: number;
  state: string;
  metro: string;
  score: number;
  grade: string;
  crossState?: boolean;
}

const REPORT_DATA: MarketRow[] = [
  { rank: 1, state: "California", metro: "San Francisco, CA", score: 99, grade: "A+" },
  { rank: 2, state: "Nebraska", metro: "North Platte, NE", score: 99, grade: "A+" },
  { rank: 3, state: "New York", metro: "Rochester, NY", score: 99, grade: "A+" },
  { rank: 4, state: "Connecticut", metro: "Norwich, CT", score: 98, grade: "A+" },
  { rank: 5, state: "New Hampshire", metro: "Manchester, NH", score: 98, grade: "A+" },
  { rank: 6, state: "Washington", metro: "Oak Harbor, WA", score: 98, grade: "A+" },
  { rank: 7, state: "Massachusetts", metro: "Springfield, MA", score: 97, grade: "A+" },
  { rank: 8, state: "New Mexico", metro: "Los Alamos, NM", score: 97, grade: "A+" },
  { rank: 9, state: "Pennsylvania", metro: "Lancaster, PA", score: 97, grade: "A+" },
  { rank: 10, state: "New Jersey", metro: "Allentown-Bethlehem-Easton, PA-NJ", score: 96, grade: "A", crossState: true },
  { rank: 11, state: "Rhode Island", metro: "Providence, RI", score: 96, grade: "A" },
  { rank: 12, state: "Iowa", metro: "Spencer, IA", score: 95, grade: "A" },
  { rank: 13, state: "Kansas", metro: "Ottawa, KS", score: 95, grade: "A" },
  { rank: 14, state: "Wisconsin", metro: "Milwaukee, WI", score: 95, grade: "A" },
  { rank: 15, state: "Illinois", metro: "Lincoln, IL", score: 94, grade: "A" },
  { rank: 16, state: "Maine", metro: "Lewiston, ME", score: 94, grade: "A" },
  { rank: 17, state: "Minnesota", metro: "La Crosse-Onalaska, WI-MN", score: 94, grade: "A", crossState: true },
  { rank: 18, state: "Michigan", metro: "Grand Rapids, MI", score: 93, grade: "A" },
  { rank: 19, state: "Ohio", metro: "Portsmouth, OH", score: 93, grade: "A" },
  { rank: 20, state: "Virginia", metro: "Richmond, VA", score: 93, grade: "A" },
  { rank: 21, state: "West Virginia", metro: "Fairmont, WV", score: 93, grade: "A" },
  { rank: 22, state: "Oklahoma", metro: "Muskogee, OK", score: 92, grade: "A-" },
  { rank: 23, state: "Maryland", metro: "Baltimore, MD", score: 91, grade: "A-" },
  { rank: 24, state: "Missouri", metro: "St. Louis, MO", score: 91, grade: "A-" },
  { rank: 25, state: "North Carolina", metro: "Virginia Beach-Norfolk-Newport News, VA-NC", score: 91, grade: "A-", crossState: true },
  { rank: 26, state: "Indiana", metro: "Decatur, IN", score: 90, grade: "A-" },
  { rank: 27, state: "South Dakota", metro: "Sioux City, IA-NE-SD", score: 89, grade: "B+", crossState: true },
  { rank: 28, state: "Nevada", metro: "Carson City, NV", score: 85, grade: "B" },
  { rank: 29, state: "Alabama", metro: "Gadsden, AL", score: 82, grade: "B-" },
  { rank: 30, state: "Utah", metro: "Vernal, UT", score: 82, grade: "B-" },
  { rank: 31, state: "Georgia", metro: "Jesup, GA", score: 81, grade: "B-" },
  { rank: 32, state: "Oregon", metro: "Portland, OR", score: 81, grade: "B-" },
  { rank: 33, state: "Delaware", metro: "Dover, DE", score: 80, grade: "B-" },
  { rank: 34, state: "Mississippi", metro: "McComb, MS", score: 79, grade: "C+" },
  { rank: 35, state: "Texas", metro: "Abilene, TX", score: 79, grade: "C+" },
  { rank: 36, state: "Alaska", metro: "Anchorage, AK", score: 77, grade: "C+" },
  { rank: 37, state: "Colorado", metro: "Denver, CO", score: 76, grade: "C" },
  { rank: 38, state: "Kentucky", metro: "Cincinnati, OH-KY-IN", score: 73, grade: "C", crossState: true },
  { rank: 39, state: "Idaho", metro: "Moscow, ID", score: 72, grade: "C-" },
  { rank: 40, state: "Tennessee", metro: "Athens, TN", score: 70, grade: "C-" },
  { rank: 41, state: "Vermont", metro: "Barre, VT", score: 66, grade: "D" },
  { rank: 42, state: "Wyoming", metro: "Casper, WY", score: 64, grade: "D" },
  { rank: 43, state: "Louisiana", metro: "Alexandria, LA", score: 60, grade: "D-" },
  { rank: 44, state: "Arkansas", metro: "Russellville, AR", score: 56, grade: "F" },
  { rank: 45, state: "South Carolina", metro: "Gaffney, SC", score: 53, grade: "F" },
  { rank: 46, state: "Florida", metro: "Lakeland, FL", score: 50, grade: "F" },
  { rank: 47, state: "Arizona", metro: "Phoenix, AZ", score: 45, grade: "F" },
  { rank: 48, state: "North Dakota", metro: "Minot, ND", score: 42, grade: "F" },
  { rank: 49, state: "Hawaii", metro: "Honolulu, HI", score: 33, grade: "F" },
  { rank: 50, state: "Montana", metro: "Butte, MT", score: 17, grade: "F" },
];

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "text-emerald-700 dark:text-emerald-400";
  if (grade.startsWith("B")) return "text-blue-700 dark:text-blue-400";
  if (grade.startsWith("C")) return "text-amber-700 dark:text-amber-400";
  return "text-red-700 dark:text-red-400";
}

function scoreBadgeClass(score: number): string {
  if (score >= 90)
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
  if (score >= 70)
    return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
  if (score >= 50)
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
}

function MetroCell({
  metro,
  crossState,
}: {
  metro: string;
  crossState?: boolean;
}) {
  const slug = TOP_MARKET_SLUGS[metro];
  const label = crossState ? `${metro}*` : metro;
  if (slug) {
    return (
      <Link
        href={`/markets/${slug}`}
        className="text-primary hover:underline font-medium"
      >
        {label}
      </Link>
    );
  }
  return <span className="font-medium">{label}</span>;
}

export default function Q2StateReportPage() {
  return (
    <>
      <WebPageJsonLd
        url={PAGE_URL}
        name="PropertyIQ Q2 2026: Best Real Estate Market in Every State"
        description="The top-ranked real estate market in all 50 states for Q2 2026, scored by the PropertyIQ Score."
        dateModified="2026-04-11"
        breadcrumbs={[
          { name: "Home", url: "https://www.propertyiq.app" },
          { name: "Reports", url: "https://www.propertyiq.app/reports" },
          { name: "Q2 2026: Best Market by State", url: PAGE_URL },
        ]}
      />

      <div className="min-h-screen bg-surface">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">

          {/* Breadcrumb */}
          <nav
            className="text-sm text-on-surface-variant mb-6"
            aria-label="Breadcrumb"
          >
            <ol className="flex items-center gap-1.5">
              <li>
                <Link href="/" className="hover:text-primary transition-colors">
                  Home
                </Link>
              </li>
              <li className="opacity-40">/</li>
              <li>
                <Link
                  href="/reports"
                  className="hover:text-primary transition-colors"
                >
                  Reports
                </Link>
              </li>
              <li className="opacity-40">/</li>
              <li className="text-on-surface">Q2 2026: Best Market by State</li>
            </ol>
          </nav>

          {/* Header */}
          <header className="mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
              Q2 2026 Report
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-on-surface tracking-tight mb-4">
              PropertyIQ Q2 2026: Best Real Estate Market in Every State
            </h1>
            <p className="text-lg text-on-surface-variant max-w-3xl leading-relaxed">
              The highest-scoring real estate market in each of the 50 states,
              ranked by the PropertyIQ Score for Q2 2026. Data sourced from
              Zillow, Census Bureau, Realtor.com, and regional economic
              indicators.
            </p>
            <p className="mt-3 text-sm text-on-surface-variant">
              Data snapshot: April 2026 &nbsp;&middot;&nbsp; 50 states covered
              &nbsp;&middot;&nbsp; Updated quarterly
            </p>
          </header>

          {/* Key Findings */}
          <section className="mb-10 bg-surface-container-low rounded-2xl p-6 border border-outline-variant/40">
            <h2 className="text-xl font-semibold text-on-surface mb-4">
              Key Findings
            </h2>
            <div className="space-y-4 text-on-surface-variant leading-relaxed">
              <p>
                <strong className="text-on-surface">
                  Strongest region this quarter:
                </strong>{" "}
                The Northeast and Upper Midwest dominate. Seven of the top 10
                state markets are in the Northeast (CA, CT, MA, ME, NH, NY, RI)
                or Mid-Atlantic corridor, with the Midwest close behind.
              </p>
              <div>
                <p className="font-medium text-on-surface mb-2">
                  Standout performers:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>
                    <Link
                      href="/markets/rochester-ny"
                      className="text-primary hover:underline"
                    >
                      Rochester, NY
                    </Link>{" "}
                    scores 99 for the third consecutive quarter, leading the
                    Northeast.
                  </li>
                  <li>
                    <Link
                      href="/markets/north-platte-ne"
                      className="text-primary hover:underline"
                    >
                      North Platte, NE
                    </Link>{" "}
                    scores 99, making Nebraska one of the strongest Midwest
                    markets by this metric.
                  </li>
                  <li>
                    <Link
                      href="/markets/milwaukee-waukesha-wi"
                      className="text-primary hover:underline"
                    >
                      Milwaukee, WI
                    </Link>{" "}
                    (95) and{" "}
                    <Link
                      href="/markets/grand-rapids-wyoming-kentwood-mi"
                      className="text-primary hover:underline"
                    >
                      Grand Rapids, MI
                    </Link>{" "}
                    (93) signal continued Midwest strength.
                  </li>
                  <li>
                    <Link
                      href="/markets/manchester-nashua-nh"
                      className="text-primary hover:underline"
                    >
                      Manchester, NH
                    </Link>{" "}
                    (98) and{" "}
                    <Link
                      href="/markets/springfield-ma"
                      className="text-primary hover:underline"
                    >
                      Springfield, MA
                    </Link>{" "}
                    (97) show the Northeast is not cooling.
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-on-surface mb-2">
                  Markets under pressure this quarter:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>
                    Montana (Butte, 17), Hawaii (Honolulu, 33), and North Dakota
                    (Minot, 42) score at the bottom of the national range.
                  </li>
                  <li>
                    Phoenix, AZ (45) and Lakeland, FL (50) reflect continued
                    softening in two markets that surged during 2021&ndash;2023.
                  </li>
                  <li>
                    South Carolina (Gaffney, 53) scores below the national
                    average despite regional Sun Belt interest.
                  </li>
                </ul>
              </div>
              <div className="pt-1">
                <p className="font-medium text-on-surface mb-2">
                  Score distribution:
                </p>
                <div className="flex flex-wrap gap-3">
                  {[
                    {
                      label: "3 states at 99 (A+)",
                      cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
                    },
                    {
                      label: "14 states scored 90+",
                      cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
                    },
                    {
                      label: "27 states scored 70+",
                      cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
                    },
                    {
                      label: "7 states scored below 50",
                      cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
                    },
                  ].map((badge) => (
                    <span
                      key={badge.label}
                      className={`px-3 py-1 rounded-full text-sm font-medium ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Report Table */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-on-surface mb-4">
              Rankings: Best Market per State &mdash; Q2 2026
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-outline-variant/40 shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-container text-on-surface-variant border-b border-outline-variant/40">
                    <th className="px-4 py-3 text-left font-semibold w-12">
                      #
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      State
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      Top Metro
                    </th>
                    <th className="px-4 py-3 text-center font-semibold w-28">
                      Score
                    </th>
                    <th className="px-4 py-3 text-center font-semibold w-20">
                      Grade
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {REPORT_DATA.map((row, i) => (
                    <tr
                      key={row.rank}
                      className={`transition-colors hover:bg-surface-container/50 ${
                        i % 2 === 0
                          ? "bg-surface"
                          : "bg-surface-container/20"
                      }`}
                    >
                      <td className="px-4 py-3 text-on-surface-variant font-mono text-xs">
                        {row.rank}
                      </td>
                      <td className="px-4 py-3 text-on-surface">
                        {row.state}
                      </td>
                      <td className="px-4 py-3">
                        <MetroCell
                          metro={row.metro}
                          crossState={row.crossState}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold tabular-nums ${scoreBadgeClass(row.score)}`}
                        >
                          {row.score}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-3 text-center font-bold ${gradeColor(row.grade)}`}
                      >
                        {row.grade}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-on-surface-variant">
              * Cross-state metro area. See notes below.
            </p>
          </section>

          {/* Cross-State Metro Notes */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-on-surface mb-3">
              Cross-State Metro Notes
            </h2>
            <p className="text-on-surface-variant mb-4 leading-relaxed">
              Five entries represent metros that span state lines. Each is the
              highest-scoring metro with meaningful data coverage in that state:
            </p>
            <ul className="space-y-2 text-sm text-on-surface-variant">
              {[
                {
                  state: "New Jersey (rank 10)",
                  note: "Allentown-Bethlehem-Easton, PA-NJ metro (Warren County, NJ included)",
                },
                {
                  state: "Minnesota (rank 17)",
                  note: "La Crosse-Onalaska, WI-MN metro (Houston County, MN included)",
                },
                {
                  state: "North Carolina (rank 25)",
                  note: "Virginia Beach-Norfolk-Newport News, VA-NC metro (Currituck, Camden, and Gates counties, NC included)",
                },
                {
                  state: "South Dakota (rank 27)",
                  note: "Sioux City, IA-NE-SD metro (Union County, SD included)",
                },
                {
                  state: "Kentucky (rank 38)",
                  note: "Cincinnati, OH-KY-IN metro (Boone, Campbell, Kenton, and other KY counties included)",
                },
              ].map((item) => (
                <li key={item.state} className="flex gap-2">
                  <span className="font-medium text-on-surface shrink-0">
                    {item.state}:
                  </span>
                  <span>{item.note}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Methodology */}
          <section className="mb-10 bg-surface-container-low rounded-2xl p-6 border border-outline-variant/40">
            <h2 className="text-xl font-semibold text-on-surface mb-3">
              Methodology
            </h2>
            <p className="text-on-surface-variant leading-relaxed">
              The PropertyIQ Score (0&ndash;100) is a composite index updated
              monthly using data from Zillow, Realtor.com, the U.S. Census
              Bureau, and regional economic indicators. A score of 50 represents
              the national average for that geography tier. Scores above 70
              indicate above-average market conditions. Scores above 90 indicate
              exceptional conditions across multiple data dimensions.
            </p>
            <p className="mt-3 text-on-surface-variant leading-relaxed">
              For this report, the highest-scoring metro within each state (as
              defined by CBSA boundaries) was selected. Where the top-scoring
              metro spans multiple states, it is attributed to the state in
              which it achieves its highest data coverage. All 50 states are
              represented with no duplicates at the state level.
            </p>
            <p className="mt-3 text-on-surface-variant">
              Scores reflect Q2 2026 data (April 2026 snapshot).
            </p>
          </section>

          {/* CTA */}
          <section className="mb-10 bg-primary/8 rounded-2xl p-8 text-center border border-primary/20">
            <h2 className="text-2xl font-bold text-on-surface mb-3">
              Explore Any Market &mdash; Free
            </h2>
            <p className="text-on-surface-variant max-w-xl mx-auto mb-6 leading-relaxed">
              PropertyIQ tracks 925 metro areas and 33,000+ ZIP codes. Get full
              score breakdowns, home value trends, rent data, and AI-powered
              market analysis &mdash; no credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center px-6 py-3 rounded-full
                  bg-primary text-on-primary font-semibold text-sm
                  hover:bg-primary/90 transition-colors shadow-sm"
              >
                Get Free Access
              </Link>
              <Link
                href="/markets"
                className="inline-flex items-center justify-center px-6 py-3 rounded-full
                  border border-outline text-on-surface font-semibold text-sm
                  hover:bg-surface-container transition-colors"
              >
                Browse All Markets
              </Link>
            </div>
          </section>

          {/* Disclaimer */}
          <section className="mb-6">
            <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface-variant leading-relaxed">
              <strong className="text-on-surface">Disclaimer:</strong>{" "}
              PropertyIQ Scores are provided for informational purposes only.
              They do not constitute investment advice, financial guidance, or a
              recommendation to buy or sell any real estate asset. Scores
              reflect market conditions at the time of data collection and do
              not guarantee future performance. Consult a licensed real estate
              professional before making investment decisions.
            </div>
          </section>

          {/* Footer nav */}
          <nav className="flex flex-wrap gap-4 text-sm text-on-surface-variant border-t border-outline-variant/30 pt-6">
            <Link
              href="/reports"
              className="hover:text-primary transition-colors"
            >
              All Reports
            </Link>
            <Link
              href="/markets"
              className="hover:text-primary transition-colors"
            >
              Market Explorer
            </Link>
            <Link
              href="/scores"
              className="hover:text-primary transition-colors"
            >
              Scores
            </Link>
            <Link
              href="/blog"
              className="hover:text-primary transition-colors"
            >
              Blog
            </Link>
            <Link
              href="/about"
              className="hover:text-primary transition-colors"
            >
              About PropertyIQ
            </Link>
          </nav>
        </div>
      </div>
    </>
  );
}

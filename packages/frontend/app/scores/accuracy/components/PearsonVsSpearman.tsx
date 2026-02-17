/**
 * Pearson vs Spearman Explainer
 *
 * Visual explanation of why Spearman rank correlation is the right metric
 * for evaluating market prediction models.
 * Server component — static educational content.
 */

import { Ruler, BarChart3, AlertTriangle, CheckCircle, TrendingUp, Shield } from 'lucide-react';

const PEARSON_POINTS = [
  {
    icon: Ruler,
    text: 'Measures how well data fits a straight line',
  },
  {
    icon: AlertTriangle,
    text: 'Easily inflated by post-hoc curve-fitting (converting scores to % forecasts via hand-tuned lookup tables)',
  },
  {
    icon: AlertTriangle,
    text: 'Sensitive to outliers \u2014 one extreme market can skew the whole number',
  },
  {
    icon: Ruler,
    text: 'A high Pearson says "I can draw a line through these dots" \u2014 not useful for market selection',
  },
];

const SPEARMAN_POINTS = [
  {
    icon: BarChart3,
    text: 'Measures whether higher scores consistently rank higher in actual returns',
  },
  {
    icon: Shield,
    text: 'Cannot be inflated by curve-fitting \u2014 ignores magnitude, only looks at rank order',
  },
  {
    icon: Shield,
    text: 'Robust to outliers \u2014 extreme values don\u2019t affect rankings',
  },
  {
    icon: CheckCircle,
    text: 'A high Spearman says "follow the score and you\u2019ll pick better markets" \u2014 exactly what investors need',
  },
];

export function PearsonVsSpearman() {
  return (
    <section>
      <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
        Understanding the Metrics
      </p>
      <h2 className="text-2xl font-[var(--font-source-serif)] text-on-surface mt-2">
        Not All Correlations Are Created Equal
      </h2>
      <p className="text-on-surface-variant mt-2 max-w-3xl">
        Some competitors report Pearson correlation. We report Spearman rank correlation.
        They measure different things &mdash; and for investors, one is clearly superior.
      </p>

      <div className="grid md:grid-cols-2 gap-4 mt-8">
        {/* Pearson Column */}
        <div className="rounded-2xl border border-outline-variant p-5 bg-surface-container">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-on-surface-variant/10">
              <Ruler className="w-4 h-4 text-on-surface-variant" />
            </div>
            <h3 className="text-sm font-semibold text-on-surface">
              Pearson <span className="font-normal text-on-surface-variant">r</span>
            </h3>
            <span className="ml-auto text-[10px] uppercase tracking-wider text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full">
              What Competitors Use
            </span>
          </div>

          <p className="text-sm text-on-surface-variant mt-3 italic">
            &quot;Can I draw a line through these dots?&quot;
          </p>

          {/* SVG illustration — loose cloud with fitted line */}
          <div className="mt-4 bg-surface rounded-xl p-3 border border-outline-variant/50">
            <svg viewBox="0 0 200 120" className="w-full h-auto" aria-label="Pearson correlation illustration: dots scattered around a fitted line">
              {/* Grid */}
              <line x1="30" y1="100" x2="190" y2="100" stroke="var(--outline-variant)" strokeWidth="0.5" />
              <line x1="30" y1="10" x2="30" y2="100" stroke="var(--outline-variant)" strokeWidth="0.5" />
              {/* Scattered dots — loose cloud */}
              <circle cx="45" cy="85" r="3" fill="var(--on-surface-variant)" opacity="0.4" />
              <circle cx="55" cy="50" r="3" fill="var(--on-surface-variant)" opacity="0.4" />
              <circle cx="65" cy="75" r="3" fill="var(--on-surface-variant)" opacity="0.4" />
              <circle cx="70" cy="30" r="3" fill="var(--on-surface-variant)" opacity="0.4" />
              <circle cx="85" cy="60" r="3" fill="var(--on-surface-variant)" opacity="0.4" />
              <circle cx="95" cy="55" r="3" fill="var(--on-surface-variant)" opacity="0.4" />
              <circle cx="100" cy="80" r="3" fill="var(--on-surface-variant)" opacity="0.4" />
              <circle cx="115" cy="45" r="3" fill="var(--on-surface-variant)" opacity="0.4" />
              <circle cx="125" cy="35" r="3" fill="var(--on-surface-variant)" opacity="0.4" />
              <circle cx="130" cy="65" r="3" fill="var(--on-surface-variant)" opacity="0.4" />
              <circle cx="145" cy="40" r="3" fill="var(--on-surface-variant)" opacity="0.4" />
              <circle cx="155" cy="15" r="3" fill="var(--on-surface-variant)" opacity="0.4" />
              <circle cx="165" cy="50" r="3" fill="var(--on-surface-variant)" opacity="0.4" />
              <circle cx="175" cy="25" r="3" fill="var(--on-surface-variant)" opacity="0.4" />
              {/* Fitted line */}
              <line x1="35" y1="85" x2="180" y2="20" stroke="var(--error)" strokeWidth="2" strokeDasharray="6 3" />
              <text x="100" y="115" textAnchor="middle" fontSize="8" fill="var(--on-surface-variant)">Score</text>
              <text x="18" y="55" textAnchor="middle" fontSize="8" fill="var(--on-surface-variant)" transform="rotate(-90, 18, 55)">Return</text>
            </svg>
          </div>

          <ul className="mt-4 space-y-2.5">
            {PEARSON_POINTS.map((point) => {
              const Icon = point.icon;
              return (
                <li key={point.text} className="flex gap-2 text-sm text-on-surface-variant">
                  <Icon className="w-4 h-4 shrink-0 mt-0.5 text-on-surface-variant/60" />
                  <span>{point.text}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Spearman Column */}
        <div className="rounded-2xl border-2 border-primary/30 p-5 bg-primary/[0.03]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <BarChart3 className="w-4 h-4 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-on-surface">
              Spearman <span className="font-normal text-on-surface-variant">&rho;</span>
            </h3>
            <span className="ml-auto text-[10px] uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full font-semibold">
              What PropertyIQ Uses
            </span>
          </div>

          <p className="text-sm text-on-surface-variant mt-3 italic">
            &quot;If I sort by score, does it match sorting by actual return?&quot;
          </p>

          {/* SVG illustration — quintile-colored dots showing rank order */}
          <div className="mt-4 bg-surface rounded-xl p-3 border border-primary/20">
            <svg viewBox="0 0 200 120" className="w-full h-auto" aria-label="Spearman correlation illustration: dots colored by quintile showing clear rank ordering">
              {/* Grid */}
              <line x1="30" y1="100" x2="190" y2="100" stroke="var(--outline-variant)" strokeWidth="0.5" />
              <line x1="30" y1="10" x2="30" y2="100" stroke="var(--outline-variant)" strokeWidth="0.5" />
              {/* Q1 dots (red — bottom quintile) */}
              <circle cx="45" cy="88" r="4" fill="#ef4444" opacity="0.7" />
              <circle cx="55" cy="82" r="4" fill="#ef4444" opacity="0.7" />
              <circle cx="50" cy="78" r="4" fill="#ef4444" opacity="0.7" />
              {/* Q2 dots (orange) */}
              <circle cx="72" cy="70" r="4" fill="#f97316" opacity="0.7" />
              <circle cx="80" cy="65" r="4" fill="#f97316" opacity="0.7" />
              <circle cx="76" cy="73" r="4" fill="#f97316" opacity="0.7" />
              {/* Q3 dots (yellow) */}
              <circle cx="100" cy="55" r="4" fill="#eab308" opacity="0.7" />
              <circle cx="108" cy="50" r="4" fill="#eab308" opacity="0.7" />
              <circle cx="104" cy="58" r="4" fill="#eab308" opacity="0.7" />
              {/* Q4 dots (light green) */}
              <circle cx="128" cy="40" r="4" fill="#22c55e" opacity="0.7" />
              <circle cx="136" cy="35" r="4" fill="#22c55e" opacity="0.7" />
              <circle cx="132" cy="42" r="4" fill="#22c55e" opacity="0.7" />
              {/* Q5 dots (green — top quintile) */}
              <circle cx="158" cy="22" r="4" fill="#059669" opacity="0.8" />
              <circle cx="166" cy="18" r="4" fill="#059669" opacity="0.8" />
              <circle cx="174" cy="15" r="4" fill="#059669" opacity="0.8" />
              {/* Quintile labels */}
              <text x="50" y="98" textAnchor="middle" fontSize="7" fill="#ef4444" fontWeight="600">Q1</text>
              <text x="76" y="85" textAnchor="middle" fontSize="7" fill="#f97316" fontWeight="600">Q2</text>
              <text x="104" y="68" textAnchor="middle" fontSize="7" fill="#eab308" fontWeight="600">Q3</text>
              <text x="132" y="53" textAnchor="middle" fontSize="7" fill="#22c55e" fontWeight="600">Q4</text>
              <text x="166" y="30" textAnchor="middle" fontSize="7" fill="#059669" fontWeight="600">Q5</text>
              <text x="100" y="115" textAnchor="middle" fontSize="8" fill="var(--on-surface-variant)">Score</text>
              <text x="18" y="55" textAnchor="middle" fontSize="8" fill="var(--on-surface-variant)" transform="rotate(-90, 18, 55)">Return</text>
            </svg>
          </div>

          <ul className="mt-4 space-y-2.5">
            {SPEARMAN_POINTS.map((point) => {
              const Icon = point.icon;
              return (
                <li key={point.text} className="flex gap-2 text-sm text-on-surface-variant">
                  <Icon className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                  <span>{point.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Finance industry callout */}
      <div className="mt-6 p-5 bg-primary-container/30 rounded-2xl border border-primary/20">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10 shrink-0 mt-0.5">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-on-surface">
              The Finance Industry Standard: Spearman, Not Pearson
            </p>
            <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
              The <strong>Information Coefficient (IC)</strong> &mdash; the gold standard for evaluating
              predictive models in quantitative finance &mdash; <em>is</em> the Spearman rank correlation.
              Hedge funds, asset managers, and quant researchers all use IC (Spearman &rho;) to measure
              whether a signal correctly <em>ranks</em> outcomes from worst to best. Pearson measures
              linearity, which can be artificially boosted through curve-fitting. We use the same metric
              the pros use.
            </p>
            <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
              For context: our Pearson r is <em>also</em> strong (0.53&ndash;0.59 on large metros).
              But Spearman is the right tool for answering the question investors actually ask:
              &quot;Will following the score lead me to better markets?&quot;
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

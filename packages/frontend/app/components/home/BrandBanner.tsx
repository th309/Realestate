"use client";

import { useInView } from "./hooks/useInView";

function fadeIn(inView: boolean, delay: string) {
  return {
    opacity: inView ? 1 : 0,
    transition: "opacity 0.8s ease",
    transitionDelay: delay,
  } as const;
}

/** Full-width brand banner matching the PropertyIQ OG image design. */
export function BrandBanner() {
  const [setRef, inView] = useInView();

  return (
    <section
      ref={setRef}
      className="relative w-full pt-16 pb-8 lg:pt-24 lg:pb-10 overflow-hidden"
      aria-label="PropertyIQ brand banner"
    >
      {/* Decorative background elements */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {/* Scattered dots */}
        <circle cx="12%" cy="65%" r="3" fill="#00C853" opacity="0.5" />
        <circle cx="18%" cy="72%" r="2" fill="#C5CAE9" opacity="0.3" />
        <circle cx="8%" cy="80%" r="1.5" fill="#00C853" opacity="0.4" />
        <circle cx="25%" cy="78%" r="2.5" fill="#C5CAE9" opacity="0.2" />
        <circle cx="15%" cy="85%" r="1.5" fill="#00C853" opacity="0.3" />
        <circle cx="30%" cy="70%" r="2" fill="#C5CAE9" opacity="0.15" />

        <circle cx="75%" cy="30%" r="2" fill="#C5CAE9" opacity="0.2" />
        <circle cx="82%" cy="25%" r="1.5" fill="#00C853" opacity="0.4" />
        <circle cx="88%" cy="20%" r="2.5" fill="#C5CAE9" opacity="0.15" />

        {/* Ascending chart line - bottom left (split into segments because SVG polyline/points doesn't accept percentage units; <line> does) */}
        {[
          ["5%", "95%", "12%", "88%"],
          ["12%", "88%", "18%", "90%"],
          ["18%", "90%", "25%", "82%"],
          ["25%", "82%", "30%", "84%"],
          ["30%", "84%", "35%", "75%"],
        ].map(([x1, y1, x2, y2], i) => (
          <line
            key={`bl-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#C5CAE9"
            strokeWidth="1.5"
            opacity="0.2"
          />
        ))}
        <circle cx="5%" cy="95%" r="2.5" fill="#C5CAE9" opacity="0.25" />
        <circle cx="12%" cy="88%" r="2.5" fill="#C5CAE9" opacity="0.25" />
        <circle cx="18%" cy="90%" r="2.5" fill="#00C853" opacity="0.35" />
        <circle cx="25%" cy="82%" r="2.5" fill="#C5CAE9" opacity="0.25" />
        <circle cx="30%" cy="84%" r="2.5" fill="#00C853" opacity="0.35" />
        <circle cx="35%" cy="75%" r="2.5" fill="#C5CAE9" opacity="0.25" />

        {/* Ascending chart line - bottom right */}
        {[
          ["70%", "95%", "78%", "88%"],
          ["78%", "88%", "82%", "85%"],
          ["82%", "85%", "88%", "72%"],
          ["88%", "72%", "92%", "68%"],
          ["92%", "68%", "97%", "55%"],
        ].map(([x1, y1, x2, y2], i) => (
          <line
            key={`br-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#C5CAE9"
            strokeWidth="1.5"
            opacity="0.2"
          />
        ))}
        <circle cx="70%" cy="95%" r="2.5" fill="#C5CAE9" opacity="0.25" />
        <circle cx="78%" cy="88%" r="2.5" fill="#00C853" opacity="0.35" />
        <circle cx="82%" cy="85%" r="2.5" fill="#C5CAE9" opacity="0.25" />
        <circle cx="88%" cy="72%" r="2.5" fill="#C5CAE9" opacity="0.25" />
        <circle cx="92%" cy="68%" r="2.5" fill="#00C853" opacity="0.35" />
        <circle cx="97%" cy="55%" r="2.5" fill="#C5CAE9" opacity="0.25" />
      </svg>

      {/* Centered brand content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6">
        {/* Logo lockup */}
        <div
          className="flex items-center gap-4 md:gap-5 mb-6"
          style={fadeIn(inView, "0s")}
        >
          {/* P monogram icon */}
          <svg
            width="56"
            height="56"
            viewBox="0 0 64 64"
            fill="none"
            className="md:w-[68px] md:h-[68px]"
            aria-hidden="true"
          >
            <rect
              width="64"
              height="64"
              rx="14"
              fill="rgba(255,255,255,0.15)"
            />
            <path
              d="M20 16V48H26V38H34C40.627 38 46 32.627 46 26C46 19.373 40.627 16 34 16H20Z"
              fill="white"
            />
            <circle cx="34" cy="26" r="6" fill="#3949AB" />
            <circle cx="44" cy="44" r="4" fill="#00C853" />
            <circle cx="36" cy="48" r="2.5" fill="#00C853" opacity="0.6" />
          </svg>

          {/* Wordmark */}
          <span className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight font-[family-name:var(--font-roboto)]">
            Property<span className="text-white/70">IQ</span>
          </span>
        </div>

        {/* Decorative accent line */}
        <div
          className="w-12 h-[3px] rounded-full bg-[#00C853]/60 mb-6"
          style={fadeIn(inView, "0.15s")}
        />

        {/* Tagline */}
        <p
          className="text-lg md:text-xl lg:text-2xl text-[#C5CAE9] tracking-wide mb-3 font-[family-name:var(--font-roboto)]"
          style={fadeIn(inView, "0.25s")}
        >
          The IQ Behind Every Market
        </p>

        {/* URL */}
        <p
          className="text-sm text-[#C5CAE9]/50 tracking-widest font-mono"
          style={fadeIn(inView, "0.35s")}
        >
          propertyiq.app
        </p>
      </div>
    </section>
  );
}

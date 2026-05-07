import React from "react";

type NarrativeSideArtProps = {
  variant: 0 | 1;
  frame: number;
};

/**
 * Decorative editorial panel for NarrativeBeat — animates continuously so even
 * long chapter reads feel “alive” without replacing copy.
 */
export const NarrativeSideArt: React.FC<NarrativeSideArtProps> = ({
  variant,
  frame,
}) => {
  const t = frame / 40;
  const pulse = 0.55 + 0.45 * Math.sin(t);

  if (variant === 0) {
    return (
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 320 420"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", maxHeight: 420 }}
        aria-hidden
      >
        <defs>
          <linearGradient id="ns-bars" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#1A237E" />
            <stop offset="100%" stopColor="#3949AB" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => {
          const baseH = 120 + i * 36;
          const h =
            baseH +
            Math.sin(frame / 22 + i * 1.7) * 28 +
            Math.cos(frame / 31 + i) * 14;
          const x = 40 + i * 52;
          return (
            <rect
              key={i}
              x={x}
              y={380 - h}
              width={36}
              height={h}
              rx={10}
              fill="url(#ns-bars)"
              opacity={0.55 + pulse * 0.12}
            />
          );
        })}
        <path
          d="M 20 120 Q 160 80 300 140"
          fill="none"
          stroke="rgba(0,200,83,0.45)"
          strokeWidth={3}
          strokeDasharray="8 12"
          transform={`translate(${Math.sin(frame / 55) * 8}, ${Math.cos(frame / 47) * 6})`}
        />
      </svg>
    );
  }

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 320 420"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", maxHeight: 420 }}
      aria-hidden
    >
      {[0, 1, 2].map((ring) => (
        <ellipse
          key={ring}
          cx={160}
          cy={210}
          rx={55 + ring * 48 + Math.sin(frame / 33 + ring) * 10}
          ry={40 + ring * 38 + Math.cos(frame / 29 + ring) * 8}
          fill="none"
          stroke={`rgba(197,202,233,${0.28 - ring * 0.06})`}
          strokeWidth={2}
          transform={`rotate(${frame / 6 + ring * 22} 160 210)`}
        />
      ))}
      <circle
        cx={160}
        cy={210}
        r={22 + pulse * 6}
        fill="rgba(57,73,171,0.45)"
      />
      <circle cx={160} cy={210} r={10} fill="#00C853" opacity={0.85} />
    </svg>
  );
};

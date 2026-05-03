"use client";

interface Props {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function ScoreRing({ score, size = "md" }: Props) {
  const px = size === "lg" ? 130 : size === "md" ? 88 : 60;
  const inset = size === "lg" ? 12 : size === "md" ? 8 : 6;
  const fontSize =
    size === "lg" ? "text-[42px]" : size === "md" ? "text-[28px]" : "text-base";
  const angle = Math.max(0, Math.min(360, (score / 100) * 360));
  return (
    <div
      className="relative grid place-items-center rounded-full"
      style={{
        width: px,
        height: px,
        background: `conic-gradient(var(--md-tertiary) 0deg ${angle}deg, var(--md-outline-variant) ${angle}deg 360deg)`,
      }}
      aria-label={`PropertyIQ Score ${score} of 100`}
    >
      <div
        className="absolute rounded-full bg-surface"
        style={{ inset }}
        aria-hidden="true"
      />
      <span
        className={`relative font-mono font-semibold text-primary-dark ${fontSize}`}
      >
        {score}
      </span>
    </div>
  );
}

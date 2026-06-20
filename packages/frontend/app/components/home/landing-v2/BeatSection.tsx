/**
 * Section shell for a single landing-v2 narrative beat.
 *
 * Provides consistent vertical rhythm, a centered max-width inner column, an
 * optional eyebrow label, and a `tone` that flips text color for where the beat
 * sits on the page's fixed indigo→light gradient (top beats are light-on-dark,
 * lower beats dark-on-light — spec §4.0). Pure layout; no client JS.
 */
export function BeatSection({
  id,
  eyebrow,
  tone = "light",
  className = "",
  children,
}: {
  id: string;
  eyebrow?: string;
  tone?: "dark" | "light";
  className?: string;
  children: React.ReactNode;
}) {
  const textColor = tone === "dark" ? "text-on-primary" : "text-on-surface";
  const eyebrowColor = tone === "dark" ? "text-primary-light" : "text-primary";
  return (
    <section
      id={id}
      className={`px-5 py-20 md:py-28 ${textColor} ${className}`}
    >
      <div className="mx-auto w-full max-w-5xl">
        {eyebrow && (
          <p
            className={`mb-3 text-sm font-medium uppercase tracking-wide ${eyebrowColor}`}
          >
            {eyebrow}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}

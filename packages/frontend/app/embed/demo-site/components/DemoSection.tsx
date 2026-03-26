interface DemoSectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  background?: "white" | "gray";
}

/**
 * Reusable section wrapper for the demo brokerage site.
 *
 * Provides consistent spacing, a serif heading, optional subtitle,
 * and alternating white/gray backgrounds.
 */
export function DemoSection({
  title,
  subtitle,
  children,
  background = "white",
}: DemoSectionProps) {
  return (
    <section
      style={{
        padding: "56px 32px",
        backgroundColor: background === "gray" ? "#f8fafc" : "#ffffff",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h2
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 28,
            fontWeight: 700,
            color: "#1e3a5f",
            margin: "0 0 8px",
            textAlign: "center",
          }}
        >
          {title}
        </h2>

        {subtitle && (
          <p
            style={{
              fontFamily: "system-ui, sans-serif",
              fontSize: 16,
              color: "#64748b",
              margin: "0 0 32px",
              textAlign: "center",
            }}
          >
            {subtitle}
          </p>
        )}

        {!subtitle && <div style={{ height: 32 }} />}

        {children}
      </div>
    </section>
  );
}

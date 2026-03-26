/**
 * Footer for the demo brokerage site.
 *
 * Shows the "powered by PropertyIQ" attribution and fake brokerage info.
 */
export function DemoFooter() {
  return (
    <footer
      style={{
        borderTop: "1px solid #e5e7eb",
        padding: "32px",
        textAlign: "center",
        backgroundColor: "#ffffff",
      }}
    >
      <p
        style={{
          fontFamily: "system-ui, sans-serif",
          fontSize: 14,
          color: "#64748b",
          margin: "0 0 8px",
        }}
      >
        Market data powered by{" "}
        <span style={{ fontWeight: 600, color: "#1e3a5f" }}>PropertyIQ</span>
      </p>
      <p
        style={{
          fontFamily: "system-ui, sans-serif",
          fontSize: 13,
          color: "#94a3b8",
          margin: 0,
        }}
      >
        Acme Real Estate Group &middot; 1234 Main Street, Dallas, TX 75201
        &middot; (555) 123-4567
      </p>
    </footer>
  );
}

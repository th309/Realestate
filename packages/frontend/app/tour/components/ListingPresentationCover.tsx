"use client";

interface Props {
  marketName: string;
  geographyDescription: string;
  households?: number;
  generatedAt: string;
}

export function ListingPresentationCover({
  marketName,
  geographyDescription,
  households,
  generatedAt,
}: Props) {
  const generatedDate = new Date(generatedAt);
  return (
    <header className="relative overflow-hidden rounded-t-2xl bg-gradient-to-br from-on-primary-container via-primary to-secondary px-12 pt-14 pb-12 text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-40"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)",
        }}
      />
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] opacity-80">
        PropertyIQ Market Intelligence
      </p>
      <h1 className="mt-3 text-[38px] font-semibold leading-[1.15] tracking-tight">
        {marketName}
        <br />
        Listing Presentation
      </h1>
      <p className="mt-1 text-base opacity-85">
        Pre-listing market analysis ·{" "}
        {generatedDate.toLocaleString("en-US", {
          month: "long",
          year: "numeric",
        })}
      </p>
      <dl className="mt-8 flex gap-8 border-t border-white/20 pt-5 text-xs">
        <Meta label="Geography" value={geographyDescription} />
        <Meta
          label="Households"
          value={
            typeof households === "number"
              ? `~${households.toLocaleString()}`
              : "—"
          }
        />
        <Meta
          label="Generated"
          value={generatedDate.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
          })}
        />
      </dl>
    </header>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.08em] opacity-65">
        {label}
      </dt>
      <dd className="mt-0.5 text-[13px] font-medium">{value}</dd>
    </div>
  );
}

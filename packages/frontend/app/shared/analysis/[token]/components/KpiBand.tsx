interface KpiItem {
  label: string;
  value: string;
}

interface Props {
  items: KpiItem[];
}

/**
 * Horizontal KPI band used on the cover page. 4-up grid with a 2-pt
 * accent rule across the top of every cell. Numbers in Roboto Mono,
 * labels in Roboto small-caps. Border-and-rule treatment ONLY — no
 * solid color fills, per editorial-memo spec.
 */
export function KpiBand({ items }: Props) {
  return (
    <div className="pdf-kpi-band">
      {items.map((item) => (
        <div key={item.label}>
          <div className="label">{item.label}</div>
          <div className="type-metric-lg">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

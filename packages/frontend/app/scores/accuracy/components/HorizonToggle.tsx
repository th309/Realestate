"use client";

interface HorizonToggleProps {
  value: "1y" | "3y";
  onChange: (horizon: "1y" | "3y") => void;
}

export function HorizonToggle({ value, onChange }: HorizonToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-outline-variant overflow-hidden">
      <button
        onClick={() => onChange("1y")}
        className={`px-4 py-1.5 text-sm font-medium transition-colors ${
          value === "1y"
            ? "bg-primary text-on-primary"
            : "bg-surface text-on-surface-variant hover:bg-surface-container-low"
        }`}
      >
        1-Year
      </button>
      <button
        onClick={() => onChange("3y")}
        className={`px-4 py-1.5 text-sm font-medium transition-colors ${
          value === "3y"
            ? "bg-primary text-on-primary"
            : "bg-surface text-on-surface-variant hover:bg-surface-container-low"
        }`}
      >
        3-Year
      </button>
    </div>
  );
}

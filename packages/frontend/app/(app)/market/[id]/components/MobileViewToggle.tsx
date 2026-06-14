"use client";

interface MobileViewToggleProps {
  activeView: "investor" | "homebuyer";
  onViewChange: (view: "investor" | "homebuyer") => void;
}

export function MobileViewToggle({
  activeView,
  onViewChange,
}: MobileViewToggleProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 md:hidden z-20">
      <div className="flex items-center bg-surface-container-high rounded-full p-1 shadow-xl border border-outline-variant">
        <button
          onClick={() => onViewChange("homebuyer")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            activeView === "homebuyer"
              ? "bg-primary text-on-primary"
              : "text-on-surface-variant"
          }`}
        >
          Buyer
        </button>
        <button
          onClick={() => onViewChange("investor")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            activeView === "investor"
              ? "bg-tertiary text-on-tertiary"
              : "text-on-surface-variant"
          }`}
        >
          Investor
        </button>
      </div>
    </div>
  );
}

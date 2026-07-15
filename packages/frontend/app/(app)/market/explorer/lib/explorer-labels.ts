export const UNIT_PLURAL: Record<string, string> = {
  state: "states",
  metro: "metros",
  county: "counties",
  zip: "ZIPs",
};

export const CHILD_PLURAL: Record<string, string> = {
  state: "metros",
  metro: "counties",
  county: "ZIP codes",
};

export const monthLabelOf = (iso?: string) =>
  iso
    ? new Date(`${iso.slice(0, 10)}T00:00:00`)
        .toLocaleString("en-US", { month: "short", year: "2-digit" })
        .replace(" ", " ’")
    : "";

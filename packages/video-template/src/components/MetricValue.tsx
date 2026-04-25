import React from "react";

interface Props {
  value_formatted: string;
  format: string;
}

export const MetricValue: React.FC<Props> = ({ value_formatted, format }) => {
  const fontSize = format === "currency" ? 110 : format === "days" ? 100 : 130;

  return (
    <div
      style={{
        fontFamily: "Roboto Mono, monospace",
        fontWeight: 600,
        fontSize,
        lineHeight: 1,
        color: "#FFFFFF",
        letterSpacing: "-0.02em",
      }}
    >
      {value_formatted}
    </div>
  );
};

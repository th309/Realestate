interface StatusDotProps {
  variant: "success" | "warning" | "error" | "info" | "neutral";
  pulse?: boolean;
  size?: "sm" | "md";
}

const variantColorMap: Record<StatusDotProps["variant"], string> = {
  success: "bg-green-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  info: "bg-blue-500",
  neutral: "bg-on-surface-variant/40",
};

const sizeMap: Record<NonNullable<StatusDotProps["size"]>, string> = {
  sm: "w-2 h-2",
  md: "w-3 h-3",
};

export function StatusDot({
  variant,
  pulse = false,
  size = "md",
}: StatusDotProps) {
  const colorClass = variantColorMap[variant];
  const sizeClass = sizeMap[size];

  return (
    <span className="relative inline-flex shrink-0">
      <span className={`${sizeClass} ${colorClass} rounded-full block`} />
      {pulse && (
        <span
          className={`absolute inset-0 ${colorClass} rounded-full animate-ping opacity-75`}
        />
      )}
    </span>
  );
}

import Image from "next/image";
import type { SharedAnalysisBranding } from "@/lib/data/fetchers/analyzer";

interface Props {
  branding: SharedAnalysisBranding | null;
  subtitle?: string;
  compact?: boolean;
}

/**
 * White-label header for the public share page and the PDF render. When the
 * owner has no organization, falls back to PropertyIQ defaults so anonymous
 * recipients still see a branded experience. The `compact` variant is used
 * by the PDF print-chrome where vertical space is at a premium.
 */
export function OrgBrandingHeader({
  branding,
  subtitle = "Deal Analysis",
  compact = false,
}: Props) {
  const orgName = branding?.org_name ?? "PropertyIQ";
  const logoUrl = branding?.logo_url ?? null;
  const padY = compact ? "py-2" : "py-4";
  const logoSize = compact ? 24 : 40;

  return (
    <div
      className={`flex items-center justify-between ${padY} border-b border-outline-variant`}
    >
      <div className="flex items-center gap-3">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={orgName}
            width={logoSize}
            height={logoSize}
            className="rounded-md object-contain"
            unoptimized
          />
        ) : (
          <div
            className="flex items-center justify-center rounded-md bg-primary text-on-primary font-bold"
            style={{
              width: logoSize,
              height: logoSize,
              fontSize: logoSize * 0.45,
            }}
          >
            P
          </div>
        )}
        <span
          className={`font-semibold text-on-surface ${compact ? "text-sm" : "text-base"}`}
        >
          {orgName}
        </span>
      </div>
      <div
        className={`text-on-surface-variant ${compact ? "text-xs" : "text-sm"} uppercase tracking-wide`}
      >
        {subtitle}
      </div>
    </div>
  );
}

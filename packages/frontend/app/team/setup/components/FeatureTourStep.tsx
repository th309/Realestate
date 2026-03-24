"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Key,
  Code2,
  Palette,
  ArrowRight,
  PartyPopper,
} from "lucide-react";

const FEATURES = [
  {
    icon: Users,
    title: "Team Members",
    description: "Manage your team, assign roles, and control access",
    path: "members",
  },
  {
    icon: Key,
    title: "API Keys",
    description: "Integrate PropertyIQ data into your own tools and dashboards",
    path: "api-keys",
  },
  {
    icon: Code2,
    title: "Embeddable Widgets",
    description: "Embed scores, metrics, and maps on your website",
    path: "embeds",
  },
  {
    icon: Palette,
    title: "Custom Branding",
    description: "Add your logo and colors to reports and widgets",
    path: "branding",
  },
];

interface FeatureTourStepProps {
  orgSlug: string;
}

export function FeatureTourStep({ orgSlug }: FeatureTourStepProps) {
  const router = useRouter();

  return (
    <div className="text-center">
      <PartyPopper className="h-10 w-10 text-primary mx-auto mb-3" />
      <h1 className="text-xl font-medium text-on-surface mb-1">
        You&apos;re All Set!
      </h1>
      <p className="text-sm text-on-surface-variant mb-8">
        Here&apos;s what you can do with your Enterprise account.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {FEATURES.map((feat) => (
          <Link
            key={feat.path}
            href={`/org/${orgSlug}/admin/${feat.path}`}
            className="bg-surface-container-low rounded-xl p-5 text-left hover:bg-surface-container transition-colors group"
          >
            <feat.icon className="h-6 w-6 text-primary mb-2" />
            <h3 className="text-sm font-medium text-on-surface mb-1">
              {feat.title}
            </h3>
            <p className="text-xs text-on-surface-variant">
              {feat.description}
            </p>
            <span className="text-xs text-primary font-medium mt-2 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              Set up <ArrowRight className="w-3 h-3" />
            </span>
          </Link>
        ))}
      </div>

      <button
        onClick={() => router.push(`/org/${orgSlug}/admin`)}
        className="px-8 py-3 bg-primary text-on-primary rounded-full text-sm font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-2"
      >
        Go to Dashboard
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

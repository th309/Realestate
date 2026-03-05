"use client";

import React from "react";

interface HeroBannerProps {
  displayName: string;
  email: string;
  avatarUrl: string | null;
  tierLabel: string;
  tierClassName: string;
  memberSince: string;
}

export function HeroBanner({
  displayName,
  email,
  avatarUrl,
  tierLabel,
  tierClassName,
  memberSince,
}: HeroBannerProps) {
  const initials = (displayName || email || "?").charAt(0).toUpperCase();

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] p-6 sm:p-8">
      {/* Decorative circles */}
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/5" />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5" />

      <div className="relative flex items-center gap-4 sm:gap-6">
        {/* Avatar */}
        {avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-white/30 flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl sm:text-3xl font-bold text-white">
              {initials}
            </span>
          </div>
        )}

        {/* Info */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
              {displayName}
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${tierClassName}`}
            >
              {tierLabel}
            </span>
          </div>
          <p className="text-sm text-white/70 truncate mt-0.5">{email}</p>
          {memberSince && (
            <p className="text-xs text-white/50 mt-1">
              Member since {memberSince}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

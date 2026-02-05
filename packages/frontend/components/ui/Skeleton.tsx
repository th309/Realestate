'use client';

import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

const variantStyles = {
  text: 'rounded',
  circular: 'rounded-full',
  rectangular: 'rounded-none',
  rounded: 'rounded-xl',
};

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}) => {
  const animationClass = animation === 'pulse' ? 'animate-pulse' : animation === 'wave' ? 'animate-shimmer' : '';

  return (
    <div
      className={`
        bg-surface-container-highest
        ${variantStyles[variant]}
        ${animationClass}
        ${className}
      `}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  );
};

// Common skeleton patterns
export const SkeletonText: React.FC<{
  lines?: number;
  className?: string;
}> = ({ lines = 3, className = '' }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          height={16}
          className={i === lines - 1 ? 'w-3/4' : 'w-full'}
        />
      ))}
    </div>
  );
};

export const SkeletonAvatar: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ size = 'md', className = '' }) => {
  const sizeMap = { sm: 32, md: 40, lg: 56 };
  return (
    <Skeleton
      variant="circular"
      width={sizeMap[size]}
      height={sizeMap[size]}
      className={className}
    />
  );
};

export const SkeletonButton: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  width?: number;
  className?: string;
}> = ({ size = 'md', width = 100, className = '' }) => {
  const heightMap = { sm: 32, md: 40, lg: 48 };
  return (
    <Skeleton
      variant="rounded"
      width={width}
      height={heightMap[size]}
      className={className}
    />
  );
};

// Card skeleton
export const SkeletonCard: React.FC<{
  hasImage?: boolean;
  hasHeader?: boolean;
  lines?: number;
  className?: string;
}> = ({ hasImage = false, hasHeader = true, lines = 3, className = '' }) => {
  return (
    <div className={`bg-surface-container-low rounded-2xl p-4 elevation-1 ${className}`}>
      {hasImage && (
        <Skeleton variant="rounded" height={160} className="w-full mb-4" />
      )}
      {hasHeader && (
        <div className="flex items-center gap-3 mb-4">
          <SkeletonAvatar size="md" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" height={16} className="w-3/4" />
            <Skeleton variant="text" height={12} className="w-1/2" />
          </div>
        </div>
      )}
      <SkeletonText lines={lines} />
    </div>
  );
};

// Table row skeleton
export const SkeletonTableRow: React.FC<{
  columns?: number;
  className?: string;
}> = ({ columns = 5, className = '' }) => {
  return (
    <div className={`flex items-center gap-4 py-3 ${className}`}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          height={16}
          className={`flex-1 ${i === 0 ? 'max-w-[200px]' : ''}`}
        />
      ))}
    </div>
  );
};

// Chart skeleton
export const SkeletonChart: React.FC<{
  type?: 'line' | 'bar' | 'pie';
  height?: number;
  className?: string;
}> = ({ type = 'line', height = 300, className = '' }) => {
  return (
    <div
      className={`bg-surface-container-low rounded-2xl p-4 ${className}`}
      style={{ height }}
    >
      {/* Chart header */}
      <div className="flex items-center justify-between mb-4">
        <Skeleton variant="text" height={20} width={150} />
        <div className="flex gap-2">
          <Skeleton variant="rounded" height={32} width={80} />
          <Skeleton variant="rounded" height={32} width={80} />
        </div>
      </div>

      {/* Chart area */}
      <div className="relative flex-1" style={{ height: height - 100 }}>
        {type === 'bar' ? (
          <div className="absolute bottom-0 left-0 right-0 flex items-end justify-around gap-2 h-full">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton
                key={i}
                variant="rectangular"
                className="flex-1 rounded-t"
                height={`${Math.random() * 60 + 40}%`}
              />
            ))}
          </div>
        ) : type === 'pie' ? (
          <div className="flex items-center justify-center h-full">
            <Skeleton variant="circular" width={200} height={200} />
          </div>
        ) : (
          <div className="h-full flex items-end">
            <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
              <path
                d="M0,150 Q50,100 100,120 T200,80 T300,100 T400,60"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-surface-container-highest animate-pulse"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton variant="circular" width={12} height={12} />
            <Skeleton variant="text" height={12} width={60} />
          </div>
        ))}
      </div>
    </div>
  );
};

// Stat card skeleton
export const SkeletonStatCard: React.FC<{
  className?: string;
}> = ({ className = '' }) => {
  return (
    <div className={`bg-surface-container-low rounded-xl p-4 elevation-1 ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <Skeleton variant="text" height={14} width={100} />
        <Skeleton variant="circular" width={24} height={24} />
      </div>
      <Skeleton variant="text" height={32} width={120} className="mb-2" />
      <div className="flex items-center gap-2">
        <Skeleton variant="rounded" height={20} width={60} />
        <Skeleton variant="text" height={12} width={80} />
      </div>
    </div>
  );
};

// Score gauge skeleton
export const SkeletonScoreGauge: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ size = 'md', className = '' }) => {
  const sizeMap = { sm: 60, md: 80, lg: 100 };
  const dim = sizeMap[size];

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <Skeleton variant="circular" width={dim} height={dim} className="mb-2" />
      <Skeleton variant="text" height={14} width={80} />
    </div>
  );
};

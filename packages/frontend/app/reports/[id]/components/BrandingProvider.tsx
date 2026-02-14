'use client';

import React, { createContext, useContext, ReactNode } from 'react';

/**
 * Configuration for white-label branding
 * Enterprise accounts can customize report appearance
 */
export interface BrandingConfig {
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  companyName: string;
  fontFamily?: string;
  headerStyle?: 'minimal' | 'full';
  footerText?: string;
  watermark?: boolean;
}

const DEFAULT_BRANDING: BrandingConfig = {
  primaryColor: '#2563eb', // blue-600
  secondaryColor: '#1e40af', // blue-800
  companyName: 'PropertyIQ',
  headerStyle: 'full',
  watermark: false,
};

const BrandingContext = createContext<BrandingConfig>(DEFAULT_BRANDING);

interface BrandingProviderProps {
  children: ReactNode;
  branding?: Partial<BrandingConfig>;
}

/**
 * Provides branding configuration to all report sections
 */
export function BrandingProvider({ children, branding }: BrandingProviderProps) {
  const mergedBranding: BrandingConfig = {
    ...DEFAULT_BRANDING,
    ...branding,
  };

  return (
    <BrandingContext.Provider value={mergedBranding}>
      {children}
    </BrandingContext.Provider>
  );
}

/**
 * Hook to access branding configuration in section components
 */
export function useBranding(): BrandingConfig {
  return useContext(BrandingContext);
}

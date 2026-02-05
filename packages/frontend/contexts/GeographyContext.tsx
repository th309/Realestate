'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Types
export type GeoLevel = 'national' | 'state' | 'metro' | 'county' | 'city' | 'zip' | 'tract';

export interface Geography {
  id: string;
  name: string;
  type: GeoLevel;
  parentId?: string;
  parentName?: string;
  state?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

interface GeographyContextValue {
  // Current selection
  geography: Geography | null;
  geoLevel: GeoLevel;

  // Actions
  setGeography: (geography: Geography | null) => void;
  setGeoLevel: (level: GeoLevel) => void;
  clearGeography: () => void;

  // History
  recentGeographies: Geography[];
  addToHistory: (geography: Geography) => void;
  clearHistory: () => void;

  // State
  isLoading: boolean;
}

const STORAGE_KEY = 'propertyiq-geography-context';
const HISTORY_KEY = 'propertyiq-geography-history';
const MAX_HISTORY = 10;

const GeographyContext = createContext<GeographyContextValue | undefined>(undefined);

export const useGeography = () => {
  const context = useContext(GeographyContext);
  if (!context) {
    throw new Error('useGeography must be used within a GeographyProvider');
  }
  return context;
};

interface GeographyProviderProps {
  children: React.ReactNode;
}

export const GeographyProvider: React.FC<GeographyProviderProps> = ({ children }) => {
  const [geography, setGeographyState] = useState<Geography | null>(null);
  const [geoLevel, setGeoLevelState] = useState<GeoLevel>('state');
  const [recentGeographies, setRecentGeographies] = useState<Geography[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedContext = localStorage.getItem(STORAGE_KEY);
      if (savedContext) {
        const parsed = JSON.parse(savedContext);
        if (parsed.geography) {
          setGeographyState(parsed.geography);
        }
        if (parsed.geoLevel) {
          setGeoLevelState(parsed.geoLevel);
        }
      }

      const savedHistory = localStorage.getItem(HISTORY_KEY);
      if (savedHistory) {
        setRecentGeographies(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.error('Error loading geography context:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save to localStorage when geography changes
  useEffect(() => {
    if (isLoading) return;

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ geography, geoLevel })
      );
    } catch (error) {
      console.error('Error saving geography context:', error);
    }
  }, [geography, geoLevel, isLoading]);

  // Save history to localStorage
  useEffect(() => {
    if (isLoading) return;

    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(recentGeographies));
    } catch (error) {
      console.error('Error saving geography history:', error);
    }
  }, [recentGeographies, isLoading]);

  const setGeography = useCallback((newGeography: Geography | null) => {
    setGeographyState(newGeography);
    if (newGeography) {
      setGeoLevelState(newGeography.type);
      // Add to history
      setRecentGeographies((prev) => {
        const filtered = prev.filter((g) => g.id !== newGeography.id);
        return [newGeography, ...filtered].slice(0, MAX_HISTORY);
      });
    }
  }, []);

  const setGeoLevel = useCallback((level: GeoLevel) => {
    setGeoLevelState(level);
  }, []);

  const clearGeography = useCallback(() => {
    setGeographyState(null);
  }, []);

  const addToHistory = useCallback((geo: Geography) => {
    setRecentGeographies((prev) => {
      const filtered = prev.filter((g) => g.id !== geo.id);
      return [geo, ...filtered].slice(0, MAX_HISTORY);
    });
  }, []);

  const clearHistory = useCallback(() => {
    setRecentGeographies([]);
  }, []);

  const value: GeographyContextValue = {
    geography,
    geoLevel,
    setGeography,
    setGeoLevel,
    clearGeography,
    recentGeographies,
    addToHistory,
    clearHistory,
    isLoading,
  };

  return (
    <GeographyContext.Provider value={value}>
      {children}
    </GeographyContext.Provider>
  );
};

// Helper hook for checking if geography matches criteria
export const useGeographyMatch = (requiredTypes?: GeoLevel[]) => {
  const { geography, geoLevel } = useGeography();

  if (!requiredTypes) return true;
  return requiredTypes.includes(geoLevel);
};

// Helper to format geography name with parent
export const formatGeographyName = (geography: Geography): string => {
  if (geography.parentName) {
    return `${geography.name}, ${geography.parentName}`;
  }
  return geography.name;
};

// Helper to get geo level display name
export const getGeoLevelDisplayName = (level: GeoLevel): string => {
  const names: Record<GeoLevel, string> = {
    national: 'National',
    state: 'State',
    metro: 'Metro Area',
    county: 'County',
    city: 'City',
    zip: 'ZIP Code',
    tract: 'Census Tract',
  };
  return names[level];
};

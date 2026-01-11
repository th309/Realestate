'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, MarketStats } from '@/lib/api/client';
import type { GeoLevel, ForecastHorizon, RentIndexType, RenterDemandType, HomeValues } from '../types';

interface UseMapDataReturn {
  homeValues: HomeValues;
  stats: MarketStats | null;
  dataLoading: boolean;
  fetchHomeValues: (
    level: GeoLevel,
    state?: string,
    metric?: string,
    horizon?: ForecastHorizon,
    rentType?: RentIndexType,
    demandType?: RenterDemandType
  ) => Promise<void>;
}

export function useMapData(): UseMapDataReturn {
  const [homeValues, setHomeValues] = useState<HomeValues>({});
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Fetch home values based on geo level and metric
  const fetchHomeValues = useCallback(async (
    level: GeoLevel,
    state?: string,
    metric?: string,
    horizon?: ForecastHorizon,
    rentType: RentIndexType = 'all',
    demandType: RenterDemandType = 'all'
  ) => {
    setDataLoading(true);
    try {
      let data: HomeValues = {};

      const isForecast = metric === 'home_price_forecast';
      const isRentIndex = metric === 'rent_index';
      const isRenterDemand = metric === 'rent_for_houses';

      switch (level) {
        case 'state':
        case 'national':
          if (isRentIndex || isRenterDemand) {
            data = {};
          } else {
            data = await api.getStateHomeValues();
          }
          break;
        case 'metro':
          if (isForecast) {
            data = await api.getMetroForecast(horizon);
          } else if (isRentIndex) {
            data = await api.getMetroRent(rentType);
          } else if (isRenterDemand) {
            data = await api.getMetroRenterDemand(demandType);
          } else {
            data = await api.getMetroHomeValues();
          }
          break;
        case 'county':
          if (isRentIndex) {
            data = await api.getCountyRent(rentType);
          } else if (isRenterDemand) {
            data = {};
          } else {
            data = await api.getCountyHomeValues();
          }
          break;
        case 'city':
          // City-level data not yet available - boundaries only
          data = {};
          break;
        case 'zip':
          if (state) {
            if (isForecast) {
              data = await api.getZipForecast(state, horizon);
            } else if (isRentIndex) {
              data = await api.getZipRent(state, rentType);
            } else if (isRenterDemand) {
              data = await api.getZipRenterDemand(state, demandType);
            } else {
              data = await api.getZipHomeValues(state);
            }
          }
          break;
        case 'tract':
          // Tract-level data not yet available - boundaries only
          data = {};
          break;
      }
      setHomeValues(data);
    } catch (err) {
      console.error('Error loading home values:', err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  // Load stats on mount
  useEffect(() => {
    api.getStats().then(setStats).catch(console.error);
  }, []);

  return {
    homeValues,
    stats,
    dataLoading,
    fetchHomeValues,
  };
}

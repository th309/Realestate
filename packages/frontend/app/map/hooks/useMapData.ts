'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, MarketStats } from '@/lib/api/client';
import type { GeoLevel, ForecastHorizon, RentIndexType, RenterDemandType, HomeValues } from '../types';

interface UseMapDataProps {
  geoLevel: GeoLevel;
  selectedState: string;
  selectedMetric: string;
  forecastHorizon: ForecastHorizon;
  rentIndexType: RentIndexType;
  renterDemandType: RenterDemandType;
  mapLoaded: boolean;
}

interface UseMapDataReturn {
  homeValues: HomeValues;
  stats: MarketStats | null;
  dataLoading: boolean;
  fetchHomeValues: (level: GeoLevel, state?: string, metric?: string, horizon?: ForecastHorizon) => Promise<void>;
}

export function useMapData({
  geoLevel,
  selectedState,
  selectedMetric,
  forecastHorizon,
  rentIndexType,
  renterDemandType,
  mapLoaded,
}: UseMapDataProps): UseMapDataReturn {
  const [homeValues, setHomeValues] = useState<HomeValues>({});
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Fetch home values based on geo level and metric
  const fetchHomeValues = useCallback(async (
    level: GeoLevel,
    state?: string,
    metric?: string,
    horizon?: ForecastHorizon
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
            data = await api.getMetroRent(rentIndexType);
          } else if (isRenterDemand) {
            data = await api.getMetroRenterDemand(renterDemandType);
          } else {
            data = await api.getMetroHomeValues();
          }
          break;
        case 'county':
          if (isRentIndex) {
            data = await api.getCountyRent(rentIndexType);
          } else if (isRenterDemand) {
            data = {};
          } else {
            data = await api.getCountyHomeValues();
          }
          break;
        case 'zip':
          if (state) {
            if (isForecast) {
              data = await api.getZipForecast(state, horizon);
            } else if (isRentIndex) {
              data = await api.getZipRent(state, rentIndexType);
            } else if (isRenterDemand) {
              data = await api.getZipRenterDemand(state, renterDemandType);
            } else {
              data = await api.getZipHomeValues(state);
            }
          }
          break;
      }
      setHomeValues(data);
    } catch (err) {
      console.error('Error loading home values:', err);
    } finally {
      setDataLoading(false);
    }
  }, [renterDemandType, rentIndexType]);

  // Load stats on mount
  useEffect(() => {
    api.getStats().then(setStats).catch(console.error);
  }, []);

  // Reload data when geo level, selected state, metric, or forecast horizon changes
  useEffect(() => {
    if (mapLoaded) {
      if (geoLevel === 'zip') {
        if (selectedState) {
          fetchHomeValues(geoLevel, selectedState, selectedMetric, forecastHorizon);
        } else {
          setHomeValues({});
          setDataLoading(false);
        }
      } else {
        fetchHomeValues(geoLevel, undefined, selectedMetric, forecastHorizon);
      }
    }
  }, [geoLevel, selectedState, selectedMetric, forecastHorizon, fetchHomeValues, mapLoaded]);

  return {
    homeValues,
    stats,
    dataLoading,
    fetchHomeValues,
  };
}

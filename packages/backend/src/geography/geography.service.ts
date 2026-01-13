import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: any[];
}

@Injectable()
export class GeographyService {
  private readonly logger = new Logger(GeographyService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async getStatesGeoJSON(): Promise<GeoJSONFeatureCollection> {
    const { data, error } = await this.supabase.rpc('get_states_geojson');
    if (error) {
      this.logger.error('Error fetching states GeoJSON', error);
      throw error;
    }
    return data;
  }

  async getCountiesGeoJSON(): Promise<GeoJSONFeatureCollection> {
    const { data, error } = await this.supabase.rpc('get_counties_geojson');
    if (error) {
      this.logger.error('Error fetching counties GeoJSON', error);
      throw error;
    }
    return data;
  }

  async getCountiesGeoJSONByState(stateAbbrev: string): Promise<GeoJSONFeatureCollection> {
    const { data, error } = await this.supabase.rpc('get_counties_geojson_by_state', {
      p_state_abbrev: stateAbbrev.toUpperCase(),
    });
    if (error) {
      this.logger.error(`Error fetching counties GeoJSON for ${stateAbbrev}`, error);
      throw error;
    }
    return data;
  }

  async getMetrosGeoJSON(): Promise<GeoJSONFeatureCollection> {
    const { data, error } = await this.supabase.rpc('get_metros_geojson');
    if (error) {
      this.logger.error('Error fetching metros GeoJSON', error);
      throw error;
    }
    return data;
  }

  async getZCTAByStateGeoJSON(stateAbbrev: string): Promise<GeoJSONFeatureCollection> {
    const { data, error } = await this.supabase.rpc('get_zcta_geojson_by_state', {
      p_state_abbrev: stateAbbrev.toUpperCase(),
    });
    if (error) {
      this.logger.error(`Error fetching ZCTAs for state ${stateAbbrev}`, error);
      throw error;
    }
    return data;
  }

  async getPlacesByStateGeoJSON(stateAbbrev: string): Promise<GeoJSONFeatureCollection> {
    const { data, error } = await this.supabase.rpc('get_places_geojson_by_state', {
      p_state_abbrev: stateAbbrev.toUpperCase(),
    });
    if (error) {
      this.logger.error(`Error fetching places for state ${stateAbbrev}`, error);
      throw error;
    }
    return data;
  }
}

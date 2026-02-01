import {
  Controller,
  Get,
  Param,
  Header,
  HttpException,
  HttpStatus,
  Logger,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { normalizeStateToCode } from '../common/geo';
import {
  GeographyService,
  GeoJSONFeatureCollection,
} from './geography.service';

@ApiTags('geography')
@Controller('api/geography')
export class GeographyController {
  private readonly logger = new Logger(GeographyController.name);

  constructor(private readonly geographyService: GeographyService) { }

  @Get('national')
  @ApiOperation({ summary: 'Get US national boundary as GeoJSON' })
  @Header('Cache-Control', 'public, max-age=86400')
  async getNational(): Promise<GeoJSONFeatureCollection> {
    try {
      return await this.geographyService.getNationalGeoJSON();
    } catch (error: any) {
      this.logger.error('Error fetching national GeoJSON', error);
      throw new HttpException(
        'Failed to fetch national GeoJSON',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('states')
  @ApiOperation({ summary: 'Get all US states as GeoJSON' })
  @Header('Cache-Control', 'public, max-age=86400')
  async getStates(): Promise<GeoJSONFeatureCollection> {
    try {
      return await this.geographyService.getStatesGeoJSON();
    } catch (error: any) {
      this.logger.error('Error fetching states GeoJSON', error);
      throw new HttpException(
        'Failed to fetch states GeoJSON',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('counties')
  @ApiOperation({ summary: 'Get all US counties as GeoJSON' })
  @Header('Cache-Control', 'public, max-age=86400')
  async getCounties(): Promise<GeoJSONFeatureCollection> {
    try {
      return await this.geographyService.getCountiesGeoJSON();
    } catch (error: any) {
      this.logger.error('Error fetching counties GeoJSON', error);
      throw new HttpException(
        'Failed to fetch counties GeoJSON',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('counties/:state')
  @ApiOperation({ summary: 'Get counties for a specific state as GeoJSON' })
  @ApiParam({
    name: 'state',
    description: 'State: two-letter code (CA), FIPS (06), or full name (California)',
  })
  @Header('Cache-Control', 'public, max-age=86400')
  async getCountiesByState(
    @Param('state') state: string,
  ): Promise<GeoJSONFeatureCollection> {
    const stateCode = normalizeStateToCode(state);
    if (!stateCode || stateCode.length !== 2) {
      throw new HttpException(
        'Invalid state. Use two-letter code (CA), FIPS (06), or full name (California).',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      return await this.geographyService.getCountiesGeoJSONByState(stateCode);
    } catch (error: any) {
      this.logger.error(`Error fetching counties GeoJSON for ${state}`, error);
      throw new HttpException(
        'Failed to fetch counties GeoJSON',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('metros')
  @ApiOperation({ summary: 'Get all metro areas (CBSAs) as GeoJSON' })
  @Header('Cache-Control', 'public, max-age=86400')
  async getMetros(): Promise<GeoJSONFeatureCollection> {
    try {
      return await this.geographyService.getMetrosGeoJSON();
    } catch (error: any) {
      this.logger.error('Error fetching metros GeoJSON', error);
      throw new HttpException(
        'Failed to fetch metros GeoJSON',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('zips/:state')
  @ApiOperation({ summary: 'Get ZIP codes for a state as GeoJSON' })
  @ApiParam({
    name: 'state',
    description: 'State: two-letter code (CA), FIPS (06), or full name (California)',
  })
  @Header('Cache-Control', 'public, max-age=86400')
  async getZipsByState(
    @Param('state') state: string,
  ): Promise<GeoJSONFeatureCollection> {
    const stateCode = normalizeStateToCode(state);
    if (!stateCode || stateCode.length !== 2) {
      throw new HttpException(
        'Invalid state. Use two-letter code (CA), FIPS (06), or full name (California).',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      return await this.geographyService.getZCTAByStateGeoJSON(stateCode);
    } catch (error: any) {
      this.logger.error(`Error fetching ZIPs GeoJSON for ${state}`, error);
      throw new HttpException(
        'Failed to fetch ZIPs GeoJSON',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('cities/:state')
  @ApiOperation({ summary: 'Get cities/places for a state as GeoJSON' })
  @ApiParam({
    name: 'state',
    description: 'State: two-letter code (CA), FIPS (06), or full name (California)',
  })
  @Header('Cache-Control', 'public, max-age=86400')
  async getCitiesByState(
    @Param('state') state: string,
  ): Promise<GeoJSONFeatureCollection> {
    const stateCode = normalizeStateToCode(state);
    if (!stateCode || stateCode.length !== 2) {
      throw new HttpException(
        'Invalid state. Use two-letter code (CA), FIPS (06), or full name (California).',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      return await this.geographyService.getPlacesByStateGeoJSON(stateCode);
    } catch (error: any) {
      this.logger.error(`Error fetching cities GeoJSON for ${state}`, error);
      throw new HttpException(
        'Failed to fetch cities GeoJSON',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('search')
  @ApiOperation({ summary: 'Search for geographies by name' })
  @ApiParam({
    name: 'query',
    description: 'Search string (e.g., "Chicago")',
  })
  @ApiParam({
    name: 'type',
    description: 'Optional geography type filter (e.g., "metro")',
    required: false,
  })
  async search(
    @Query('query') query: string,
    @Query('type') type?: string,
  ): Promise<any[]> {
    if (!query || query.length < 2) {
      throw new HttpException(
        'Query must be at least 2 characters',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      return await this.geographyService.searchGeographies(query, type);
    } catch (error: any) {
      this.logger.error(`Error searching geographies for "${query}"`, error);
      throw new HttpException(
        'Failed to search geographies',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

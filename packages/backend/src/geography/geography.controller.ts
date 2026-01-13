import { Controller, Get, Param, Header, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { GeographyService, GeoJSONFeatureCollection } from './geography.service';

@ApiTags('geography')
@Controller('api/geography')
export class GeographyController {
  private readonly logger = new Logger(GeographyController.name);

  constructor(private readonly geographyService: GeographyService) {}

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
  @ApiParam({ name: 'state', description: 'Two-letter state abbreviation (e.g., CA, TX)' })
  @Header('Cache-Control', 'public, max-age=86400')
  async getCountiesByState(@Param('state') state: string): Promise<GeoJSONFeatureCollection> {
    if (!/^[A-Za-z]{2}$/.test(state)) {
      throw new HttpException(
        'Invalid state code. Must be two-letter abbreviation.',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      return await this.geographyService.getCountiesGeoJSONByState(state);
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
  @ApiParam({ name: 'state', description: 'Two-letter state abbreviation (e.g., CA, TX)' })
  @Header('Cache-Control', 'public, max-age=86400')
  async getZipsByState(@Param('state') state: string): Promise<GeoJSONFeatureCollection> {
    if (!/^[A-Za-z]{2}$/.test(state)) {
      throw new HttpException(
        'Invalid state code. Must be two-letter abbreviation.',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      return await this.geographyService.getZCTAByStateGeoJSON(state);
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
  @ApiParam({ name: 'state', description: 'Two-letter state abbreviation (e.g., CA, TX)' })
  @Header('Cache-Control', 'public, max-age=86400')
  async getCitiesByState(@Param('state') state: string): Promise<GeoJSONFeatureCollection> {
    if (!/^[A-Za-z]{2}$/.test(state)) {
      throw new HttpException(
        'Invalid state code. Must be two-letter abbreviation.',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      return await this.geographyService.getPlacesByStateGeoJSON(state);
    } catch (error: any) {
      this.logger.error(`Error fetching cities GeoJSON for ${state}`, error);
      throw new HttpException(
        'Failed to fetch cities GeoJSON',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

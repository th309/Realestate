import { Controller, Get, Query } from '@nestjs/common';
import { GeocodeAddressDto } from './dto/geocode-address.dto';
import { GeocodingService, type GeocodeResult } from './geocoding.service';

@Controller('api/geocoding')
export class GeocodingController {
  constructor(private readonly geocoding: GeocodingService) {}

  @Get('resolve')
  async resolve(
    @Query() query: GeocodeAddressDto,
  ): Promise<GeocodeResult | null> {
    return this.geocoding.resolve(query.address);
  }
}

import { Injectable } from '@nestjs/common';
import { OvervaluedMetricsMetrosService } from './overvalued-metrics-metros.service';
import { OvervaluedMetricsCountiesService } from './overvalued-metrics-counties.service';
import { OvervaluedMetricsZipsService } from './overvalued-metrics-zips.service';

@Injectable()
export class OvervaluedMetricsService {
  constructor(
    private readonly metros: OvervaluedMetricsMetrosService,
    private readonly counties: OvervaluedMetricsCountiesService,
    private readonly zips: OvervaluedMetricsZipsService,
  ) {}

  calculateOvervaluedForMetros(year?: number) {
    return this.metros.calculateOvervaluedForMetros(year);
  }

  calculateOvervaluedForCounties() {
    return this.counties.calculateOvervaluedForCounties();
  }

  calculateOvervaluedForZips() {
    return this.zips.calculateOvervaluedForZips();
  }
}

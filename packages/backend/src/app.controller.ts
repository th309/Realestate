import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('api/health')
  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }

  // Unprefixed liveness probe — Railway's default healthcheck path is /health,
  // not /api/health. Returns 200 as soon as the Nest application is listening;
  // no DB call, no external dependency, so a degraded DB doesn't mark the
  // container unhealthy.
  @Get('health')
  getRailwayHealth(): { status: string; timestamp: string } {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }
}

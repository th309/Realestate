/**
 * Trigger Pipeline DTO
 *
 * Validates the optional filter parameters when triggering a pipeline manually.
 * Filters allow subset selection (e.g., specific metrics or geographies).
 */

import { IsOptional, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TriggerPipelineDto {
  @IsOptional()
  @IsObject()
  @ApiPropertyOptional({
    description: 'Filter parameters to run a subset of the pipeline',
    example: { metric: ['zhvi'], geography: ['state', 'metro'] },
  })
  filters?: Record<string, string[]>;
}

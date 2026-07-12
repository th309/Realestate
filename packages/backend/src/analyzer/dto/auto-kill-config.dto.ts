/**
 * Validation DTOs for the optional `autoKills` block on user thresholds.
 * Mirrors the *AutoKillConfig shapes in @propertyiq/analyzer-core.
 *
 * Bounds (shared with the frontend drawer validators):
 *   DSCR floors 0.3-2.0 · shares 0.05-1.0 · dollars 0-500 000 · DOM multiple 1-10
 */
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const NUM_OPTS = { allowNaN: false, allowInfinity: false } as const;

class ToggleRuleDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
}

class DscrFloorRuleDto extends ToggleRuleDto {
  @IsOptional() @IsNumber(NUM_OPTS) @Min(0.3) @Max(2) value?: number;
}

class ShareRuleDto extends ToggleRuleDto {
  @IsOptional() @IsNumber(NUM_OPTS) @Min(0.05) @Max(1) value?: number;
}

class DollarsRuleDto extends ToggleRuleDto {
  @IsOptional() @IsNumber(NUM_OPTS) @Min(0) @Max(500_000) value?: number;
}

class MultiplierRuleDto extends ToggleRuleDto {
  @IsOptional() @IsNumber(NUM_OPTS) @Min(1) @Max(10) value?: number;
}

export class BuyAndHoldAutoKillsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => DscrFloorRuleDto)
  dscrFloor?: DscrFloorRuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShareRuleDto)
  taxInsShareOfRent?: ShareRuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ToggleRuleDto)
  floodNoInsurance?: ToggleRuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ToggleRuleDto)
  negativeCashflowNoAck?: ToggleRuleDto;
}

export class FixAndFlipAutoKillsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ToggleRuleDto)
  projectLoss?: ToggleRuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DollarsRuleDto)
  minNetProfit?: DollarsRuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShareRuleDto)
  rehabContingency?: ShareRuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MultiplierRuleDto)
  extremeHold?: MultiplierRuleDto;
}

export class BrrrrAutoKillsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => DscrFloorRuleDto)
  refiDscrFloor?: DscrFloorRuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ToggleRuleDto)
  negativePostRefiCashflow?: ToggleRuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShareRuleDto)
  rehabContingency?: ShareRuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DollarsRuleDto)
  maxCashLeft?: DollarsRuleDto;
}

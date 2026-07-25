import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Body for POST /runs/:id/reject — a bounded, non-empty rejection reason. */
export class RejectRunDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}

/** Body for POST /runs/:id/cancel — an optional, bounded cancellation reason. */
export class CancelRunDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

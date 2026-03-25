import { IsInt, Min } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for updating seat count.
 *
 * Accepts either `additionalSeats` (camelCase) or `additional_seats`
 * (snake_case) from the request body to support frontend conventions.
 */
export class UpdateSeatsDto {
  @IsInt()
  @Min(0)
  @Transform(({ obj }) => obj.additionalSeats ?? obj.additional_seats)
  additionalSeats: number;
}

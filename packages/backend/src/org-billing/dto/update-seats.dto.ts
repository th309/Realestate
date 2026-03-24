import { IsInt, Min } from 'class-validator';

export class UpdateSeatsDto {
  @IsInt()
  @Min(0)
  additionalSeats: number;
}

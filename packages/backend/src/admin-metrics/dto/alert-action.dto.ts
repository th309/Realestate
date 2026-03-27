import { IsUUID } from 'class-validator';

export class AlertActionParamsDto {
  @IsUUID()
  id: string;
}

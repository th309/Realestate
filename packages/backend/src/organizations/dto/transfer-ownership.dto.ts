import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class TransferOwnershipDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  newOwnerId: string;
}

import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Body for POST /runs/:id/edit-script. `variantId` is restricted to the two
 * real script variants, and `newFullText` is bounded + non-empty so an edit
 * can't overwrite the stored script asset with an empty or unbounded string.
 */
export class EditScriptDto {
  @IsIn(['A', 'B'])
  variantId!: 'A' | 'B';

  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  newFullText!: string;
}

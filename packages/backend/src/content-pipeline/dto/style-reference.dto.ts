import { IsIn, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateStyleReferenceDto {
  @IsString() label!: string;

  // Operators tag references by what they're for. The Remotion variants
  // (Task 2.28) read this field to filter reference candidates per format.
  @IsIn(['thumbnail', 'video', 'pdf', 'general'])
  kind!: string;

  // Either a public URL OR a Supabase Storage URL (supabase://bucket/path).
  @IsString() source_url!: string;

  // Optional: skip Vision extract on create (defer to manual Re-extract later).
  @IsOptional() @IsString() preview_strip_url?: string;
}

export class UpdateStyleReferenceDto {
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsUrl() preview_strip_url?: string;
}

import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateStyleReferenceDto {
  @IsString() @Length(1, 200) label!: string;

  // Operators tag references by what they're for. The Remotion variants
  // (Task 2.28) read this field to filter reference candidates per format.
  @IsIn(['thumbnail', 'video', 'pdf', 'general'])
  kind!: string;

  // Either a public https URL OR a Supabase Storage URL
  // (supabase://bucket/path). The preview mirror additionally enforces
  // public-host DNS resolution before any server-side fetch.
  @IsString()
  @MaxLength(2000)
  @Matches(/^(https|supabase):\/\//, {
    message: 'source_url must start with https:// or supabase://',
  })
  source_url!: string;

  // Optional: skip Vision extract on create (defer to manual Re-extract later).
  @IsOptional() @IsString() @MaxLength(2000) preview_strip_url?: string;
}

export class UpdateStyleReferenceDto {
  @IsOptional() @IsString() @Length(1, 200) label?: string;
  @IsOptional() @IsUrl() @MaxLength(2000) preview_strip_url?: string;
}

export class IngestVideoUrlDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2000)
  url!: string;

  @IsString() @Length(1, 200) label!: string;
}

export class UploadVideoDto {
  @IsString() @Length(1, 200) label!: string;
}

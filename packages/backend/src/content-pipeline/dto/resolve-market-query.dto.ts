import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body for POST /resolve-market. The query flows into geography search, so it
 * must be a bounded non-empty string (was an unvalidated inline `{ query }`,
 * which let empty/huge input 500 instead of 400).
 */
export class ResolveMarketQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  query!: string;
}

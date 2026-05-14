import { IsObject, IsOptional } from 'class-validator';

/**
 * Request body for POST /api/analyzer/ai-verdict.
 *
 * Fields are intentionally loose Record<string, unknown> because the verdict
 * prompt is built by JSON-stringifying the values — strict shape validation
 * would couple this DTO to the frontend's analyzer state machine, which
 * evolves independently. The class-validator presence checks below ensure
 * the bodies are at least well-formed objects (not arrays / nulls / primitives).
 */
export class AiVerdictRequestDto {
  @IsObject()
  input!: Record<string, unknown>;

  @IsObject()
  result!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  marketContext?: Record<string, unknown>;
}

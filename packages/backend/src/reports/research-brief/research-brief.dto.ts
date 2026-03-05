/**
 * Research Brief DTOs
 *
 * Request/response validation for the research brief API endpoints.
 */

import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

/**
 * POST /api/reports/research/clarify
 * Request clarifying questions for a research topic.
 */
export class ResearchClarifyDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsString()
  @IsOptional()
  context?: string;
}

/**
 * POST /api/reports/research/generate
 * Generate a full research brief from question + clarifying answers.
 */
export class ResearchGenerateDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsObject()
  @IsOptional()
  clarifying_answers?: Record<string, string>;

  @IsString()
  @IsOptional()
  context?: string;
}

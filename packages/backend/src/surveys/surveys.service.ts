import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { verifyNpsToken } from './nps-token.util';

export interface SubmitSurveyDto {
  token: string;
  score: number;
  comment?: string;
}

export interface SubmitChurnSurveyDto {
  token: string;
  reasonCode: string;
  detail?: string;
}

const EMAIL_TYPE_TO_COHORT: Record<string, string> = {
  churn_why_zero_session: 'zero_session',
  churn_why_tried_once: 'tried_once',
  churn_why_engaged_quiet: 'engaged_quiet',
};

@Injectable()
export class SurveysService {
  private readonly logger = new Logger(SurveysService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly config: ConfigService,
  ) {}

  async submitNpsSurvey(
    dto: SubmitSurveyDto,
  ): Promise<{ ok: boolean; error?: string }> {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) {
      this.logger.error('JWT_SECRET not configured');
      return { ok: false, error: 'Server misconfiguration' };
    }

    const payload = verifyNpsToken(dto.token, secret);
    if (!payload) {
      return { ok: false, error: 'Invalid or expired survey token' };
    }

    if (dto.score < 0 || dto.score > 10 || !Number.isInteger(dto.score)) {
      return { ok: false, error: 'Score must be an integer between 0 and 10' };
    }

    const { error } = await this.supabase.from('user_surveys').upsert(
      {
        user_id: payload.userId,
        survey_type: payload.surveyType,
        score: dto.score,
        comment: dto.comment ?? null,
      },
      { onConflict: 'user_id,survey_type' },
    );

    if (error) {
      this.logger.error(`Failed to save survey response: ${error.message}`);
      return { ok: false, error: 'Failed to save response' };
    }

    return { ok: true };
  }

  async submitChurnSurvey(
    dto: SubmitChurnSurveyDto,
  ): Promise<{ ok: boolean; error?: string }> {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) {
      this.logger.error('JWT_SECRET not configured');
      return { ok: false, error: 'Server misconfiguration' };
    }

    const payload = verifyNpsToken(dto.token, secret);
    if (!payload) {
      return { ok: false, error: 'Invalid or expired survey token' };
    }

    if (!dto.reasonCode || typeof dto.reasonCode !== 'string') {
      return { ok: false, error: 'reasonCode is required' };
    }

    const cohort = EMAIL_TYPE_TO_COHORT[payload.surveyType];
    if (!cohort) {
      return { ok: false, error: 'Unrecognized survey type' };
    }

    const { error } = await this.supabase.from('churn_survey_responses').upsert(
      {
        user_id: payload.userId,
        cohort,
        email_type: payload.surveyType,
        reason_code: dto.reasonCode,
        detail: dto.detail ?? null,
      },
      { onConflict: 'user_id,email_type' },
    );

    if (error) {
      this.logger.error(
        `Failed to save churn survey response: ${error.message}`,
      );
      return { ok: false, error: 'Failed to save response' };
    }

    return { ok: true };
  }
}

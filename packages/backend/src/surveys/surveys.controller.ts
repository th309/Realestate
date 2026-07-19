import {
  Controller,
  Post,
  Body,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SurveysService } from './surveys.service';

class SubmitNpsSurveyBody {
  token!: string;
  score!: number;
  comment?: string;
}

class SubmitChurnSurveyBody {
  token!: string;
  reasonCode!: string;
  detail?: string;
}

@Controller('api/surveys')
export class SurveysController {
  constructor(private readonly surveysService: SurveysService) {}

  /**
   * POST /api/surveys
   *
   * Records an NPS survey response. No session auth required — the `token`
   * in the body is a signed short-lived token from the day-30 email link.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async submitSurvey(@Body() body: SubmitNpsSurveyBody) {
    if (!body.token || body.score === undefined || body.score === null) {
      throw new BadRequestException('token and score are required');
    }

    const result = await this.surveysService.submitNpsSurvey({
      token: body.token,
      score: body.score,
      comment: body.comment,
    });

    if (!result.ok) {
      throw new BadRequestException(result.error);
    }

    return { success: true };
  }

  /**
   * POST /api/surveys/churn
   *
   * Records a churn-why survey response. No session auth required — the
   * `token` in the body is a signed short-lived token from the churn-why
   * email link, same pattern as the NPS endpoint above.
   */
  @Post('churn')
  @HttpCode(HttpStatus.OK)
  async submitChurnSurvey(@Body() body: SubmitChurnSurveyBody) {
    if (!body.token || !body.reasonCode) {
      throw new BadRequestException('token and reasonCode are required');
    }

    const result = await this.surveysService.submitChurnSurvey({
      token: body.token,
      reasonCode: body.reasonCode,
      detail: body.detail,
    });

    if (!result.ok) {
      throw new BadRequestException(result.error);
    }

    return { success: true };
  }
}

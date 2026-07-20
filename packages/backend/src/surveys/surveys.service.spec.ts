import { SurveysService } from './surveys.service';
import * as npsToken from './nps-token.util';

describe('SurveysService.submitChurnSurvey', () => {
  const upsert = jest.fn().mockResolvedValue({ error: null });
  const from = jest.fn().mockReturnValue({ upsert });
  const supabase = { from } as any;
  const config = {
    get: jest.fn().mockReturnValue('test-secret'),
  } as any;

  beforeEach(() => {
    upsert.mockClear();
    from.mockClear();
  });

  it('rejects an invalid token', async () => {
    jest.spyOn(npsToken, 'verifyNpsToken').mockReturnValueOnce(null);
    const service = new SurveysService(supabase, config);

    const result = await service.submitChurnSurvey({
      token: 'bad-token',
      reasonCode: 'busy',
    });

    expect(result.ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it('rejects a missing reasonCode', async () => {
    jest.spyOn(npsToken, 'verifyNpsToken').mockReturnValueOnce({
      userId: 'user-1',
      surveyType: 'churn_why_zero_session',
      exp: Date.now() + 10000,
    });
    const service = new SurveysService(supabase, config);

    const result = await service.submitChurnSurvey({
      token: 'good-token',
      reasonCode: '',
    });

    expect(result.ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it('upserts a valid response, deriving cohort from the token surveyType', async () => {
    jest.spyOn(npsToken, 'verifyNpsToken').mockReturnValueOnce({
      userId: 'user-1',
      surveyType: 'churn_why_tried_once',
      exp: Date.now() + 10000,
    });
    const service = new SurveysService(supabase, config);

    const result = await service.submitChurnSurvey({
      token: 'good-token',
      reasonCode: 'too_expensive',
      detail: 'pricing was unclear',
    });

    expect(result.ok).toBe(true);
    expect(from).toHaveBeenCalledWith('churn_survey_responses');
    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        cohort: 'tried_once',
        email_type: 'churn_why_tried_once',
        reason_code: 'too_expensive',
        detail: 'pricing was unclear',
      },
      { onConflict: 'user_id,email_type' },
    );
  });
});

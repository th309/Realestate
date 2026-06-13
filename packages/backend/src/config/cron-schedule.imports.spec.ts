import { cronScheduleImports } from './cron-schedule.imports';

describe('cronScheduleImports', () => {
  const original = process.env.RUN_CRONS;
  afterEach(() => {
    if (original === undefined) delete process.env.RUN_CRONS;
    else process.env.RUN_CRONS = original;
  });

  it('returns no schedule module when RUN_CRONS is unset', () => {
    delete process.env.RUN_CRONS;
    expect(cronScheduleImports()).toHaveLength(0);
  });

  it('returns no schedule module when RUN_CRONS is not exactly "true"', () => {
    process.env.RUN_CRONS = 'false';
    expect(cronScheduleImports()).toHaveLength(0);
    process.env.RUN_CRONS = '1';
    expect(cronScheduleImports()).toHaveLength(0);
    process.env.RUN_CRONS = 'TRUE';
    expect(cronScheduleImports()).toHaveLength(0);
  });

  it('registers exactly one schedule module when RUN_CRONS=true', () => {
    process.env.RUN_CRONS = 'true';
    expect(cronScheduleImports()).toHaveLength(1);
  });
});

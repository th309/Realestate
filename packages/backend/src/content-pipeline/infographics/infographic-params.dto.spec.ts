import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { InfographicRunParamsDto } from './infographic-params.dto';

function validate(params: unknown) {
  const dto = plainToInstance(InfographicRunParamsDto, params);
  return validateSync(dto as object);
}

function failedProperties(params: unknown): string[] {
  return validate(params)
    .map((e) => e.property)
    .sort();
}

const VALID = {
  topic_slug: 'mcp-for-agents',
  task_number: 1,
  style_id: 'flat-editorial',
};

describe('InfographicRunParamsDto accepts a generatable request', () => {
  it('passes for a vetted topic, a real task number and an approved style', () => {
    expect(validate(VALID)).toHaveLength(0);
  });

  it('passes for the last task of the vetted topic', () => {
    expect(validate({ ...VALID, task_number: 6 })).toHaveLength(0);
  });

  it('passes for every approved style id', () => {
    for (const styleId of [
      'flat-editorial',
      'flat-editorial-map',
      'clean-modern-flat',
      'sketch-note',
      'glassmorphic-bento',
      'cartoon-mascot',
    ]) {
      expect(validate({ ...VALID, style_id: styleId })).toHaveLength(0);
    }
  });
});

describe('InfographicRunParamsDto rejects unusable requests', () => {
  it('rejects an unknown topic slug', () => {
    expect(failedProperties({ ...VALID, topic_slug: 'not-a-topic' })).toContain(
      'topic_slug',
    );
  });

  it('rejects an unvetted topic even when the task number exists', () => {
    const errors = validate({ ...VALID, topic_slug: 'how-to-map' });
    const taskError = errors.find((e) => e.property === 'task_number');
    expect(taskError).toBeDefined();
    expect(Object.values(taskError!.constraints ?? {}).join(' ')).toContain(
      'not vetted',
    );
  });

  it('rejects a task number the vetted topic does not have', () => {
    const errors = validate({ ...VALID, task_number: 99 });
    const taskError = errors.find((e) => e.property === 'task_number');
    expect(taskError).toBeDefined();
    expect(Object.values(taskError!.constraints ?? {}).join(' ')).toContain(
      'task number must be one of',
    );
  });

  it('rejects a zero or negative task number', () => {
    expect(failedProperties({ ...VALID, task_number: 0 })).toContain(
      'task_number',
    );
    expect(failedProperties({ ...VALID, task_number: -3 })).toContain(
      'task_number',
    );
  });

  it('rejects a non-integer task number', () => {
    expect(failedProperties({ ...VALID, task_number: 1.5 })).toContain(
      'task_number',
    );
  });

  it('rejects an unknown style id', () => {
    expect(failedProperties({ ...VALID, style_id: 'steampunk' })).toContain(
      'style_id',
    );
  });

  it('rejects a CLI style flag used as a style id', () => {
    expect(failedProperties({ ...VALID, style_id: 'editorial' })).toContain(
      'style_id',
    );
  });

  it('rejects missing fields', () => {
    expect(failedProperties({})).toEqual([
      'style_id',
      'task_number',
      'topic_slug',
    ]);
  });

  it('rejects wrong types', () => {
    expect(
      failedProperties({
        topic_slug: 42,
        task_number: 'one',
        style_id: null,
      }),
    ).toEqual(['style_id', 'task_number', 'topic_slug']);
  });
});

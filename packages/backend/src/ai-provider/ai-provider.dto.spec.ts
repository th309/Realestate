import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateModelConfigDto } from './ai-provider.dto';

describe('UpdateModelConfigDto shadow fields', () => {
  it('accepts a valid shadow config', async () => {
    const dto = plainToInstance(UpdateModelConfigDto, {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      shadow_provider: 'deepseek',
      shadow_model: 'deepseek-v4-pro',
      shadow_sample_rate: 0.25,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts null shadow_provider (shadow disabled)', async () => {
    const dto = plainToInstance(UpdateModelConfigDto, {
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      shadow_provider: null,
      shadow_model: null,
      shadow_sample_rate: 0,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an unknown shadow_provider', async () => {
    const dto = plainToInstance(UpdateModelConfigDto, {
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      shadow_provider: 'not-a-provider',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'shadow_provider')).toBe(true);
  });

  it('rejects shadow_sample_rate above 1', async () => {
    const dto = plainToInstance(UpdateModelConfigDto, {
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      shadow_sample_rate: 1.5,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'shadow_sample_rate')).toBe(true);
  });
});

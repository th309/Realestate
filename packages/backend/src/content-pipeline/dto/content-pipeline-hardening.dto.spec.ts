import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ResolveMarketQueryDto } from './resolve-market-query.dto';
import { EditScriptDto } from './edit-script.dto';
import { RejectRunDto, CancelRunDto } from './run-reason.dto';
import { isContentFormat } from './content-format';

const errorsFor = (cls: any, obj: unknown) =>
  validate(plainToInstance(cls, obj));

describe('content-pipeline controller hardening DTOs', () => {
  describe('ResolveMarketQueryDto', () => {
    it('accepts a bounded non-empty query', async () => {
      expect(
        await errorsFor(ResolveMarketQueryDto, { query: 'Austin, TX' }),
      ).toHaveLength(0);
    });
    it('rejects empty and over-long queries', async () => {
      expect(
        (await errorsFor(ResolveMarketQueryDto, { query: '' })).length,
      ).toBeGreaterThan(0);
      expect(
        (await errorsFor(ResolveMarketQueryDto, { query: 'x'.repeat(201) }))
          .length,
      ).toBeGreaterThan(0);
    });
    it('rejects a non-string query', async () => {
      expect(
        (await errorsFor(ResolveMarketQueryDto, { query: 123 })).length,
      ).toBeGreaterThan(0);
    });
  });

  describe('EditScriptDto', () => {
    it('accepts a valid A/B edit', async () => {
      expect(
        await errorsFor(EditScriptDto, {
          variantId: 'A',
          newFullText: 'hello',
        }),
      ).toHaveLength(0);
    });
    it('rejects a variant outside A|B', async () => {
      const errors = await errorsFor(EditScriptDto, {
        variantId: 'C',
        newFullText: 'hello',
      });
      expect(errors.some((e) => e.property === 'variantId')).toBe(true);
    });
    it('rejects empty and over-long newFullText', async () => {
      expect(
        (await errorsFor(EditScriptDto, { variantId: 'A', newFullText: '' }))
          .length,
      ).toBeGreaterThan(0);
      expect(
        (
          await errorsFor(EditScriptDto, {
            variantId: 'A',
            newFullText: 'x'.repeat(20001),
          })
        ).length,
      ).toBeGreaterThan(0);
    });
  });

  describe('RejectRunDto / CancelRunDto', () => {
    it('reject requires a bounded non-empty reason', async () => {
      expect(
        await errorsFor(RejectRunDto, { reason: 'off-brand' }),
      ).toHaveLength(0);
      expect(
        (await errorsFor(RejectRunDto, { reason: '' })).length,
      ).toBeGreaterThan(0);
      expect((await errorsFor(RejectRunDto, {})).length).toBeGreaterThan(0);
    });
    it('cancel reason is optional but bounded', async () => {
      expect(await errorsFor(CancelRunDto, {})).toHaveLength(0);
      expect(
        await errorsFor(CancelRunDto, { reason: 'changed mind' }),
      ).toHaveLength(0);
      expect(
        (await errorsFor(CancelRunDto, { reason: 'x'.repeat(1001) })).length,
      ).toBeGreaterThan(0);
    });
  });

  describe('isContentFormat', () => {
    it('accepts real ContentFormat values and rejects others', () => {
      expect(isContentFormat('top_10_ranking')).toBe(true);
      expect(isContentFormat('recruitment_angle')).toBe(true);
      expect(isContentFormat('not_a_format')).toBe(false);
      expect(isContentFormat('')).toBe(false);
    });
  });
});

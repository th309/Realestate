import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateBrandDto } from './update-brand.dto';

// Exercise the DTO exactly as the HTTP layer does: transform + whitelist so we
// verify bounded strings, platform allow-list, nested rejection, and that the
// fixed ban flags are stripped (not persisted).
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
});

function transform(payload: unknown): Promise<UpdateBrandDto> {
  return pipe.transform(payload, {
    type: 'body',
    metatype: UpdateBrandDto,
  }) as Promise<UpdateBrandDto>;
}

describe('UpdateBrandDto validation', () => {
  it('accepts a valid partial patch', async () => {
    const dto = await transform({
      name: 'PropertyIQ',
      websiteUrl: 'https://www.propertyiq.app',
      targetPlatforms: ['linkedin', 'x', 'youtube'],
      approvedCopy: {
        coverageStat: '900+ metros, 3,000+ counties, 29,000+ ZIPs',
      },
    });
    expect(dto.name).toBe('PropertyIQ');
    expect(dto.targetPlatforms).toContain('x');
  });

  it('rejects an over-long name', async () => {
    await expect(transform({ name: 'a'.repeat(200) })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a non-URL websiteUrl', async () => {
    await expect(transform({ websiteUrl: 'not a url' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects an unknown target platform', async () => {
    await expect(
      transform({ targetPlatforms: ['myspace'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a product entry missing required name/summary', async () => {
    await expect(transform({ products: [{}] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('strips the fixed ban flags but keeps editable ban lists', async () => {
    const dto = await transform({
      approvedCopy: {
        bans: {
          noEmOrEnDashes: false,
          neverNameCompetitors: false,
          hypePhrases: ['synergy'],
          competitors: ['SomeRival'],
        },
      },
    });
    const bans = dto.approvedCopy?.bans as Record<string, unknown> | undefined;
    expect(bans).toBeDefined();
    // Fixed flags are not part of BansDto → whitelist strips them.
    expect(bans).not.toHaveProperty('noEmOrEnDashes');
    expect(bans).not.toHaveProperty('neverNameCompetitors');
    // Editable lists survive.
    expect(bans?.hypePhrases).toEqual(['synergy']);
    expect(bans?.competitors).toEqual(['SomeRival']);
  });

  it('rejects an over-long coverage stat', async () => {
    await expect(
      transform({ approvedCopy: { coverageStat: 'x'.repeat(300) } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

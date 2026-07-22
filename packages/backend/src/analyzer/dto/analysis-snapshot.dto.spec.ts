import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AnalysisSnapshotDto } from './analysis-snapshot.dto';

const errorsFor = (body: object) =>
  validateSync(plainToInstance(AnalysisSnapshotDto, body));

const validBody = {
  address_full: '123 Main St, Austin, TX',
  address_city: 'Austin',
  address_state: 'TX',
  input_snapshot: {},
  result_snapshot: {},
};

describe('AnalysisSnapshotDto', () => {
  it('accepts a valid payload with address_full present', () => {
    expect(errorsFor(validBody)).toHaveLength(0);
  });

  it('rejects a payload with address_full missing', () => {
    const { address_full: _omit, ...rest } = validBody;
    expect(errorsFor(rest).length).toBeGreaterThan(0);
  });

  it('rejects a payload with address_full empty', () => {
    expect(
      errorsFor({ ...validBody, address_full: '' }).length,
    ).toBeGreaterThan(0);
  });

  it('rejects a payload with address_full whitespace-only', () => {
    // Without the @Transform trim, '   ' passes @IsNotEmpty() (it has
    // length) and would reintroduce the bare ", " blank-address bug the
    // dedupe migration fixed.
    expect(
      errorsFor({ ...validBody, address_full: '   ' }).length,
    ).toBeGreaterThan(0);
  });

  it('trims surrounding whitespace from address_full before validation', () => {
    const instance = plainToInstance(AnalysisSnapshotDto, {
      ...validBody,
      address_full: '  123 Main St, Austin, TX  ',
    });
    expect(instance.address_full).toBe('123 Main St, Austin, TX');
    expect(validateSync(instance)).toHaveLength(0);
  });
});

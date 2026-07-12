import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  BrrrrAutoKillsDto,
  BuyAndHoldAutoKillsDto,
  FixAndFlipAutoKillsDto,
} from './auto-kill-config.dto';

const errorsFor = (cls: new () => object, body: object) =>
  validateSync(plainToInstance(cls, body));

describe('auto-kill config DTOs', () => {
  it('accepts a full valid B&H block', () => {
    expect(
      errorsFor(BuyAndHoldAutoKillsDto, {
        dscrFloor: { enabled: true, value: 0.9 },
        taxInsShareOfRent: { enabled: false, value: 0.5 },
        floodNoInsurance: { enabled: false },
        negativeCashflowNoAck: {},
      }),
    ).toHaveLength(0);
  });

  it('accepts an empty block and partial blocks', () => {
    expect(errorsFor(BuyAndHoldAutoKillsDto, {})).toHaveLength(0);
    expect(
      errorsFor(FixAndFlipAutoKillsDto, { minNetProfit: { value: 5000 } }),
    ).toHaveLength(0);
  });

  it('rejects DSCR floor outside 0.3-2.0', () => {
    expect(
      errorsFor(BuyAndHoldAutoKillsDto, { dscrFloor: { value: 0.1 } }).length,
    ).toBeGreaterThan(0);
    expect(
      errorsFor(BrrrrAutoKillsDto, { refiDscrFloor: { value: 2.5 } }).length,
    ).toBeGreaterThan(0);
  });

  it('rejects share outside 0.05-1.0', () => {
    expect(
      errorsFor(BuyAndHoldAutoKillsDto, {
        taxInsShareOfRent: { value: 0.01 },
      }).length,
    ).toBeGreaterThan(0);
  });

  it('rejects dollars outside 0-500000 and multiplier outside 1-10', () => {
    expect(
      errorsFor(FixAndFlipAutoKillsDto, {
        minNetProfit: { value: 600_000 },
      }).length,
    ).toBeGreaterThan(0);
    expect(
      errorsFor(FixAndFlipAutoKillsDto, { extremeHold: { value: 0.5 } }).length,
    ).toBeGreaterThan(0);
  });

  it('rejects non-boolean enabled', () => {
    expect(
      errorsFor(BuyAndHoldAutoKillsDto, {
        dscrFloor: { enabled: 'yes' },
      }).length,
    ).toBeGreaterThan(0);
  });
});

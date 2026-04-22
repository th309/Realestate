export interface DriverCost {
  provider: string;
  amount_usd: number;
  units: number;
  unit_type:
    | 'tokens_input'
    | 'tokens_output'
    | 'chars'
    | 'seconds'
    | 'frames'
    | 'requests';
}

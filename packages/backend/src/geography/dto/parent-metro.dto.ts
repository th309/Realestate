import { Matches } from 'class-validator';

export class GetParentMetroParamsDto {
  @Matches(/^\d{5}$/, { message: 'fips must be a 5-digit county FIPS code' })
  fips!: string;
}

export interface ParentMetroResult {
  county_fips: string;
  cbsa_code: string | null;
  cbsa_name: string | null;
}

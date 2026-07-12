/**
 * Body for DELETE /push/subscriptions.
 */

import { IsUrl, MaxLength } from 'class-validator';

export class UnsubscribePushDto {
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'endpoint must be a valid https URL' },
  )
  @MaxLength(2048)
  endpoint: string;
}

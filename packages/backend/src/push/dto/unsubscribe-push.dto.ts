/**
 * Body for DELETE /push/subscriptions.
 */

import { IsUrl } from 'class-validator';

export class UnsubscribePushDto {
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'endpoint must be a valid https URL' },
  )
  endpoint: string;
}

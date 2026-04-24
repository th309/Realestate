import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { LeadMagnetKind } from '../drivers/lead-magnet-renderer.interface';

/**
 * Admin-only request body for POST /api/admin/content-pipeline/trigger-test-magnet.
 *
 * Enqueues a `render-pdf` job end-to-end so operators can verify the
 * lead-magnet delivery pipeline (render + storage + email attachment)
 * against a real market + recipient without going through the public
 * signup flow.
 */
export class TriggerTestMagnetDto {
  @IsString()
  @MinLength(2)
  marketQuery!: string;

  @IsOptional()
  @IsIn(['market_snapshot_pdf'])
  magnetKind?: LeadMagnetKind;

  /**
   * Overrides the recipient inbox. Defaults to the calling admin's own
   * email, so the admin never accidentally emails a real customer while
   * smoke-testing.
   */
  @IsOptional()
  @IsEmail()
  recipientEmailOverride?: string;
}

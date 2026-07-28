import { IsUUID, Matches, MaxLength } from 'class-validator';

/**
 * Path params for POST /runs/:id/slots/:slotId.
 *
 * slotId is not merely a label — it becomes a path segment in Supabase
 * Storage (`runs/<runId>/slots/<slotId>.<ext>`), so an unvalidated value lets
 * a caller climb out of the run's prefix with `../` and overwrite another
 * run's assets. Slot ids are identifiers declared by a format, so an
 * allowlist of letters, digits, dash and underscore covers every real one and
 * makes traversal unrepresentable.
 */
export class UploadMediaSlotParamsDto {
  @IsUUID()
  id!: string;

  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'slotId may contain only letters, digits, dashes and underscores',
  })
  slotId!: string;
}

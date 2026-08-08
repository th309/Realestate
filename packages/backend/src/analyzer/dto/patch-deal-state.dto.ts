import { IsObject } from 'class-validator';

/**
 * Payload for PATCH /api/analyzer/saved/:id/state — the autosave target.
 *
 * Deliberately narrow. Autosave persists the user's working state and
 * nothing else: `result_snapshot` is the published share artifact and must
 * only change when the user deliberately shares or exports, and
 * `market_context` is the restore source for a saved deal. Accepting either
 * here would let a keystroke mutate a link already in a client's hands.
 */
export class PatchDealStateDto {
  @IsObject()
  input_snapshot!: Record<string, unknown>;
}

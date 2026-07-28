import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin-auth.guard';
import { CopySuggestService } from './copy-suggest.service';
import {
  CopySuggestDto,
  DEFAULT_COPY_SUGGEST_ITEM_COUNT,
} from '../dto/copy-suggest.dto';

/**
 * Marketing drafts for the wizard's copy step.
 *
 * Its own controller on the shared `api/admin/content-pipeline` prefix, which
 * NestJS allows and this module already does twice (see the note in
 * ContentPipelineRunsController). `copy-suggest` is a static segment and no
 * controller on this prefix declares a root-level `:param` route, so nothing
 * shadows it in either direction.
 */
@UseGuards(AdminGuard)
@Controller('api/admin/content-pipeline')
export class CopySuggestController {
  constructor(private readonly copySuggest: CopySuggestService) {}

  /**
   * Always 200 when the request itself is valid: a model outage returns
   * `degraded: true` with empty fields rather than an error, because an
   * operator must never be blocked from authoring by a copy draft.
   */
  @Post('copy-suggest')
  async suggestCopy(@Body() dto: CopySuggestDto) {
    const data = await this.copySuggest.suggest({
      formatKey: dto.formatKey,
      itemCount: dto.itemCount ?? DEFAULT_COPY_SUGGEST_ITEM_COUNT,
      context: dto.context ?? {},
    });
    return { success: true, data };
  }
}

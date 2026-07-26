// packages/backend/src/content-pipeline/infographics/infographic-options.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin-auth.guard';
import { INFOGRAPHIC_STYLES } from './infographic-styles';
import { INFOGRAPHIC_TOPICS } from './infographic-topics';

/**
 * Picker options for the admin infographic composer: which topics can be
 * generated from and which approved visual styles exist.
 *
 * Notebook and source ids stay server-side — they are generation
 * infrastructure, not something the picker needs.
 */
@UseGuards(AdminGuard)
@Controller('api/admin/content-pipeline')
export class InfographicOptionsController {
  @Get('infographic-options')
  infographicOptions() {
    return {
      success: true,
      data: {
        topics: INFOGRAPHIC_TOPICS.map((topic) => ({
          slug: topic.slug,
          title: topic.title,
          // Unvetted topic docs still carry the DRAFT banner; the UI should
          // show them as unselectable rather than hide them.
          vetted: topic.vetted,
          tasks: topic.tasks.map((task) => ({
            number: task.number,
            label: task.label,
          })),
        })),
        // {id, label} only — the VISUAL STYLE descriptor is prompt text the
        // worker uses, not something the picker renders.
        styles: INFOGRAPHIC_STYLES.map((style) => ({
          id: style.id,
          label: style.label,
        })),
      },
    };
  }
}

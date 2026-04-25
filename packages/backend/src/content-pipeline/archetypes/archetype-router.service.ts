import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

export interface RouterContext {
  format: string;
  marketName: string;
  audience?: 'investor' | 'agent' | 'broker' | 'mixed';
  approvalMode?: 'auto' | 'review' | 'draft';
}

export interface RoutedArchetype {
  slug: string;
  display_name: string;
  prompt_template: string;
}

/**
 * ArchetypeRouter — picks which script_archetype a given run should use.
 *
 * STUB: this is the seam for user-supplied editorial logic. The
 * algorithm-of-record lives with Troy and isn't in this codebase yet —
 * the chosen approach (round-robin? best-performing? format-affinity-
 * weighted? operator-curated rotation?) is an open editorial question.
 *
 * Until then, routeForRun() picks deterministically:
 *   1. enabled archetype whose `format_affinity` includes the run's format
 *   2. ordered by median_view_count desc (best performer wins)
 *   3. falls back to null if nothing matches — the script generator
 *      already handles the no-archetype path.
 *
 * The contract is intentionally narrow so the eventual real router can
 * drop in without touching call sites: same input shape, same return type.
 */
@Injectable()
export class ArchetypeRouter {
  private readonly logger = new Logger(ArchetypeRouter.name);

  constructor(private readonly supabase: SupabaseService) {}

  async routeForRun(ctx: RouterContext): Promise<RoutedArchetype | null> {
    const client = this.supabase.getClient();
    const { data } = await client
      .from('script_archetypes')
      .select(
        'slug, display_name, prompt_template, format_affinity, median_view_count',
      )
      .eq('enabled', true)
      .order('median_view_count', { ascending: false, nullsFirst: false });
    const all = (data ?? []) as Array<{
      slug: string;
      display_name: string;
      prompt_template: string;
      format_affinity: string[];
      median_view_count: number | null;
    }>;
    const match = all.find((a) => a.format_affinity.includes(ctx.format));
    if (!match) {
      this.logger.log(
        `[ROUTER] no archetype for format=${ctx.format} — script generator will use the format's default prompt`,
      );
      return null;
    }
    this.logger.log(
      `[ROUTER] picked slug=${match.slug} for format=${ctx.format} market=${ctx.marketName}`,
    );
    return {
      slug: match.slug,
      display_name: match.display_name,
      prompt_template: match.prompt_template,
    };
  }
}

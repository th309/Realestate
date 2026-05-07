import { Injectable } from '@nestjs/common';
import { ContentDataService } from '../data/content-data.service';

export interface SuggestedRun {
  title: string;
  reason: string;
  createPayload: {
    format: string;
    marketQuery: string;
    approvalMode?: 'auto' | 'review' | 'draft';
  };
}

@Injectable()
export class SuggestedRunsService {
  constructor(private readonly contentData: ContentDataService) {}

  /**
   * Lightweight heuristics (P4) to suggest a handful of high-signal runs
   * without inventing data or overfitting rules:
   * - Prefer metros with strong movers (where we have real data).
   * - Provide a couple of format options for operators to try quickly.
   */
  async getSuggestions(): Promise<SuggestedRun[]> {
    const movers = await this.contentData.getTopMovers('metro', 30, 12);
    const markets = [...(movers?.up ?? []), ...(movers?.down ?? [])]
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 6);

    const suggestions: SuggestedRun[] = [];
    for (const m of markets) {
      const marketQuery = m.canonical_name;
      suggestions.push({
        title: `Score mover: ${marketQuery}`,
        reason:
          'Recent 30d movers show clear directional change; good for fast performance learnings.',
        createPayload: {
          format: 'score_mover',
          marketQuery,
          approvalMode: 'review',
        },
      });
      suggestions.push({
        title: `Grade reveal: ${marketQuery}`,
        reason:
          'Stable baseline format to compare against experimental hooks/magnets.',
        createPayload: {
          format: 'grade_reveal',
          marketQuery,
          approvalMode: 'review',
        },
      });
    }

    return suggestions.slice(0, 10);
  }
}

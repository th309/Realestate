/**
 * Fetcher for the infographic topic + style catalog.
 *
 * Options are derived from the topic docs in
 * `docs/content-pipeline/infographic-topics/`, so `vetted` is a property of the
 * doc (a draft doc has not been reviewed and must not be generated from), and
 * `tasks` are that doc's own numbered task list. The product rule is one task
 * per graphic, so a run always names exactly one `number` from one topic.
 *
 * Lives beside the other per-surface admin fetchers rather than inside
 * `content-pipeline-api.ts`, which is at its 300-line hard limit.
 */
import { ApiError, fetchAPI } from "@/lib/data/fetchers/base";

export interface InfographicTask {
  /** The task's number in its topic doc — carried into the run params. */
  number: number;
  label: string;
}

export interface InfographicTopic {
  slug: string;
  title: string;
  /** False while the topic doc is still a draft: shown, but not selectable. */
  vetted: boolean;
  tasks: InfographicTask[];
}

export interface InfographicStyle {
  id: string;
  label: string;
}

export interface InfographicOptions {
  topics: InfographicTopic[];
  styles: InfographicStyle[];
}

type InfographicOptionsResponse = Partial<InfographicOptions> & {
  data?: Partial<InfographicOptions>;
};

/**
 * Reads the catalog. Accepts both the bare `{ topics, styles }` body and the
 * `{ data: { topics, styles } }` envelope the other admin endpoints use, so the
 * step keeps working whichever shape the backend settles on.
 */
export async function fetchInfographicOptions(): Promise<InfographicOptions> {
  const res = await fetchAPI<InfographicOptionsResponse>(
    "/api/admin/content-pipeline/infographic-options",
  );
  const payload = res.data ?? res;
  return {
    topics: payload.topics ?? [],
    styles: payload.styles ?? [],
  };
}

/**
 * True when the catalog endpoint isn't there. Lets the step say "not available
 * yet" instead of "something went wrong" while the service is being built out.
 */
export function isMissingInfographicCatalog(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

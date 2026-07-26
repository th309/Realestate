// packages/backend/scripts/infographic-worker/resolve-claimable-run.ts
import {
  findInfographicStyle,
  type InfographicStyle,
} from '../../src/content-pipeline/infographics/infographic-styles';
import {
  findInfographicTopic,
  findInfographicTopicTask,
  type InfographicTopic,
  type InfographicTopicTask,
} from '../../src/content-pipeline/infographics/infographic-topics';

export interface InfographicRunParams {
  topic_slug: string;
  task_number: number;
  style_id: string;
}

/** A queued run resolved against the registries and ready to generate. */
export interface ClaimableRun {
  id: string;
  topic: InfographicTopic;
  task: InfographicTopicTask;
  style: InfographicStyle;
  /** Non-null once resolved — resolveClaimableRun rejects topics without one. */
  notebookId: string;
}

export interface QueuedRunRow {
  id: string;
  format_options: Record<string, unknown> | null;
}

/**
 * Turn a raw queued row into everything generation needs, or throw with the
 * reason the run cannot proceed (the caller marks it failed).
 */
export function resolveClaimableRun(row: QueuedRunRow): ClaimableRun {
  const params = (row.format_options ?? {}).infographic as
    | InfographicRunParams
    | undefined;
  if (!params) throw new Error('run has no format-options infographic params');

  const topic = findInfographicTopic(params.topic_slug);
  if (!topic) throw new Error(`unknown topic slug ${params.topic_slug}`);
  if (!topic.vetted) throw new Error(`topic ${topic.slug} is not vetted`);

  const task = findInfographicTopicTask(topic, params.task_number);
  if (!task) {
    throw new Error(`topic ${topic.slug} has no task ${params.task_number}`);
  }

  const style = findInfographicStyle(params.style_id);
  if (!style) throw new Error(`unknown style id ${params.style_id}`);

  if (!topic.notebookId) {
    throw new Error(`topic ${topic.slug} has no notebook wired up`);
  }

  return { id: row.id, topic, task, style, notebookId: topic.notebookId };
}

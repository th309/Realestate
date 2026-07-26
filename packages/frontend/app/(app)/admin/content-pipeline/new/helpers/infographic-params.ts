/**
 * Selection rules for the infographic step, kept pure so the two rules that
 * matter are testable without rendering:
 *
 *  - one task per graphic — a run carries exactly one task number, never a list;
 *  - a draft topic is never generated from, so an unvetted topic can be shown
 *    but can never produce a run.
 *
 * A complete selection resolves to a plan: the wire params plus the labels the
 * confirm step reads back to the operator, built in one place so the summary
 * can never drift from what gets submitted.
 */
import type {
  InfographicOptions,
  InfographicTopic,
} from "../../lib/infographic-options-api";
import type { InfographicRunParams } from "../../lib/create-run-api";

export const INFOGRAPHIC_FORMAT = "infographic";

export interface InfographicSelection {
  topicSlug: string;
  taskNumber: number | null;
  styleId: string;
}

export const EMPTY_INFOGRAPHIC_SELECTION: InfographicSelection = {
  topicSlug: "",
  taskNumber: null,
  styleId: "",
};

export interface InfographicRunPlan {
  params: InfographicRunParams;
  topicTitle: string;
  taskLabel: string;
  styleLabel: string;
  /** Human-readable label stored on the run and shown in lists and review. */
  runLabel: string;
}

/** Topics an operator may generate from. Drafts are shown but never offered. */
export function vettedTopics(topics: InfographicTopic[]): InfographicTopic[] {
  return topics.filter((topic) => topic.vetted);
}

/**
 * Resolves a selection into a submittable plan, or null when the selection
 * can't legally produce a graphic — nothing picked, an unknown task number, or
 * a topic doc that has not been vetted yet.
 */
export function buildInfographicRunPlan(
  selection: InfographicSelection,
  options: InfographicOptions,
): InfographicRunPlan | null {
  const topic = options.topics.find((t) => t.slug === selection.topicSlug);
  if (!topic || !topic.vetted || selection.taskNumber == null) return null;

  const task = topic.tasks.find((t) => t.number === selection.taskNumber);
  const style = options.styles.find((s) => s.id === selection.styleId);
  if (!task || !style) return null;

  return {
    params: {
      topic_slug: topic.slug,
      task_number: task.number,
      style_id: style.id,
    },
    topicTitle: topic.title,
    taskLabel: task.label,
    styleLabel: style.label,
    runLabel: `${topic.title} — ${task.label}`,
  };
}

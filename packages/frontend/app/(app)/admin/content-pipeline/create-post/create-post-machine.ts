/**
 * Pure state → payload logic for the guided create-post flow. Kept free of React
 * so the flow's rules (what grounds each post type, when Generate is allowed,
 * the exact payload shape) are unit-testable without rendering.
 *
 * The flow collects three things — a post `type`, its grounding (a market query
 * for image/carousel posts, or a free-text topic for `from_topic`), and one
 * target `platform` — then maps them to the frozen generate-endpoint payload.
 */
import type {
  GeneratePostInput,
  GeneratePostPlatform,
  GeneratePostType,
} from "../lib/posts-api";

/** Server also enforces this; the UI stops the operator before the request. */
export const TOPIC_MAX_LENGTH = 300;

/** The five platforms the flow offers, in display order. */
export const CREATE_POST_PLATFORMS: GeneratePostPlatform[] = [
  "instagram",
  "facebook",
  "tiktok",
  "linkedin",
  "x",
];

export interface CreatePostState {
  type: GeneratePostType;
  /** Market grounding for `image_post` / `carousel`. */
  marketQuery?: string;
  /** Free-text idea for `from_topic`. */
  topic?: string;
  platform?: GeneratePostPlatform;
}

/** `from_topic` is grounded by free text; the other types by a market query. */
export function usesTopicGrounding(type: GeneratePostType): boolean {
  return type === "from_topic";
}

/**
 * Whether the grounding step is satisfied for the current type. Topic must be
 * non-empty and within the length cap; a market query must be non-empty.
 */
export function isGroundingComplete(state: CreatePostState): boolean {
  if (usesTopicGrounding(state.type)) {
    const topic = state.topic?.trim() ?? "";
    return topic.length > 0 && topic.length <= TOPIC_MAX_LENGTH;
  }
  return (state.marketQuery?.trim() ?? "").length > 0;
}

/** Generate is allowed once grounding is complete and a platform is chosen. */
export function canGenerate(state: CreatePostState): boolean {
  return isGroundingComplete(state) && state.platform != null;
}

/**
 * Build the generate-endpoint payload, or `null` when the flow is incomplete.
 * Includes exactly one grounding field — `topic` for `from_topic`, else
 * `marketQuery` — and never both, so the payload matches the frozen contract.
 */
export function buildGeneratePayload(
  state: CreatePostState,
): GeneratePostInput | null {
  if (!canGenerate(state) || state.platform == null) return null;

  const base: GeneratePostInput = {
    type: state.type,
    platform: state.platform,
  };

  if (usesTopicGrounding(state.type)) {
    return { ...base, topic: state.topic!.trim() };
  }
  return { ...base, marketQuery: state.marketQuery!.trim() };
}

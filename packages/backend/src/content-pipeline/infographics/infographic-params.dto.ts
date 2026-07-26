// packages/backend/src/content-pipeline/infographics/infographic-params.dto.ts
import {
  IsIn,
  IsInt,
  IsString,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { INFOGRAPHIC_STYLES } from './infographic-styles';
import { INFOGRAPHIC_TOPICS, findInfographicTopic } from './infographic-topics';

const TOPIC_SLUGS = INFOGRAPHIC_TOPICS.map((t) => t.slug);
const STYLE_IDS = INFOGRAPHIC_STYLES.map((s) => s.id);

/**
 * Cross-field check: the task number must exist inside the chosen topic, and
 * the topic must be vetted. Unvetted topic docs still carry the "DRAFT -
 * pending Troy's vetting" banner and must never reach a generator.
 */
@ValidatorConstraint({ name: 'isGeneratableTopicTask', async: false })
export class IsGeneratableTopicTaskConstraint implements ValidatorConstraintInterface {
  validate(taskNumber: unknown, args: ValidationArguments): boolean {
    const { topic_slug: topicSlug } = args.object as { topic_slug?: unknown };
    if (typeof topicSlug !== 'string') return false;
    const topic = findInfographicTopic(topicSlug);
    if (!topic || !topic.vetted) return false;
    return topic.tasks.some((t) => t.number === taskNumber);
  }

  defaultMessage(args: ValidationArguments): string {
    const { topic_slug: topicSlug } = args.object as { topic_slug?: unknown };
    if (typeof topicSlug !== 'string') {
      return 'task number cannot be checked without a valid topic slug';
    }
    const topic = findInfographicTopic(topicSlug);
    if (!topic) return `unknown topic slug ${topicSlug}`;
    if (!topic.vetted) {
      return `topic ${topicSlug} is not vetted yet and cannot be generated from`;
    }
    const valid = topic.tasks.map((t) => t.number).join(', ');
    return `task number must be one of ${valid} for topic ${topicSlug}`;
  }
}

/** Params carried by an `infographic` content run. Shape is pinned for the admin UI. */
export class InfographicRunParamsDto {
  @IsString()
  @IsIn(TOPIC_SLUGS, {
    message: `topic slug must be one of: ${TOPIC_SLUGS.join(', ')}`,
  })
  topic_slug!: string;

  @IsInt()
  @Min(1)
  @Validate(IsGeneratableTopicTaskConstraint)
  task_number!: number;

  @IsString()
  @IsIn(STYLE_IDS, {
    message: `style id must be one of: ${STYLE_IDS.join(', ')}`,
  })
  style_id!: string;
}

// packages/backend/src/content-pipeline/infographics/infographic-topics.ts
/**
 * Registry of infographic source topics, derived from the markdown topic docs in
 * `docs/content-pipeline/infographic-topics/`.
 *
 * Checked in as a constant on purpose: the markdown docs are NOT readable at
 * runtime in production (non-TS files only ship if listed in nest-cli.json
 * assets), so the registry must not depend on them. When a topic doc changes,
 * update this file in the same commit.
 *
 * `vetted: false` mirrors the "DRAFT - pending Troy's vetting" banner in the
 * doc. Only vetted topics may be generated from — the README review gate.
 *
 * Each generation run targets exactly ONE task (README rule 0: one task per
 * infographic), so tasks are addressed by their number within the doc.
 */

export interface InfographicTopicTask {
  number: number;
  label: string;
}

export interface InfographicTopic {
  slug: string;
  title: string;
  vetted: boolean;
  /** NotebookLM notebook holding this topic doc as a source; null until created. */
  notebookId: string | null;
  /** The topic doc's source id inside that notebook; null until uploaded. */
  sourceId: string | null;
  tasks: InfographicTopicTask[];
}

export const INFOGRAPHIC_TOPICS: readonly InfographicTopic[] = [
  {
    slug: 'mcp-for-agents',
    title: 'What Real Estate Agents Can Do with the PropertyIQ MCP',
    vetted: true,
    notebookId: 'aeefc5b2-e8a3-4ee9-b41d-b3046c3eca9f',
    sourceId: '7e35c2cc-e94a-428b-af1e-1b3f364eb2eb',
    tasks: [
      { number: 1, label: 'Find your farm area' },
      { number: 2, label: 'Walk into listings armed' },
      { number: 3, label: 'Prep a buyer consult in minutes' },
      { number: 4, label: 'Win relocation clients' },
      { number: 5, label: 'Stay in front of your sphere' },
      { number: 6, label: 'For team leads and brokers' },
    ],
  },
  {
    slug: 'mcp-for-investors',
    title: 'What Real Estate Investors Can Do with the PropertyIQ MCP',
    vetted: false,
    notebookId: null,
    sourceId: null,
    tasks: [
      { number: 1, label: 'Screen a whole state for cashflow' },
      { number: 2, label: 'Run the napkin math on a ZIP' },
      { number: 3, label: 'Pressure-test one specific deal' },
      { number: 4, label: 'Choose your tradeoff: appreciation or cashflow' },
      { number: 5, label: 'Check where the market sits in its cycle' },
      { number: 6, label: 'Plan a 1031 exchange' },
      { number: 7, label: 'Find the concentration risk in your portfolio' },
      {
        number: 8,
        label: 'Judge a short-term rental market before you furnish it',
      },
    ],
  },
  {
    slug: 'score-explainer',
    title: 'The PropertyIQ Score, Honestly Explained',
    vetted: false,
    notebookId: null,
    sourceId: null,
    tasks: [
      { number: 1, label: 'What the number is' },
      { number: 2, label: 'How to read the momentum label' },
      { number: 3, label: 'A low score is not a bad market' },
      { number: 4, label: 'The letter is about the data, not the score' },
      { number: 5, label: 'The four inputs' },
      { number: 6, label: 'Computed nationally, calibrated to a state' },
      { number: 7, label: 'What the score has actually predicted' },
      { number: 8, label: 'Where you can get one' },
    ],
  },
  {
    slug: 'how-to-analyzer',
    title: 'Analyzing a Deal by Address with the Deal Analyzer',
    vetted: false,
    notebookId: null,
    sourceId: null,
    tasks: [
      { number: 1, label: 'Start from an address' },
      { number: 2, label: "Pick the strategy you're actually running" },
      { number: 3, label: 'Let it pick the strategy for you' },
      { number: 4, label: 'Read the rental numbers' },
      { number: 5, label: 'Read the value-add numbers' },
      { number: 6, label: 'Find your break-even' },
      { number: 7, label: 'Stress-test the assumptions' },
      { number: 8, label: 'See the market around the property' },
      { number: 9, label: 'Save it, share it, take it with you' },
    ],
  },
  {
    slug: 'how-to-map',
    title: 'Using the PropertyIQ Interactive Map',
    vetted: false,
    notebookId: null,
    sourceId: null,
    tasks: [
      { number: 1, label: 'Pick your lens: Homebuyer or Investor' },
      { number: 2, label: 'Choose your geography level' },
      {
        number: 3,
        label: 'Read a category by its question, not its jargon',
      },
      { number: 4, label: 'Read the color scale' },
      { number: 5, label: 'Turn on the PropertyIQ Score layer' },
      { number: 6, label: 'Find a market without hunting' },
      { number: 7, label: "Open a market's detail panel" },
      { number: 8, label: 'See where each number came from' },
      { number: 9, label: 'Right-click a region to go deeper' },
      { number: 10, label: 'Get the data out' },
    ],
  },
  {
    slug: 'how-to-reports',
    title: 'Building AI Market Reports',
    vetted: false,
    notebookId: null,
    sourceId: null,
    tasks: [
      { number: 1, label: 'Pick your first market' },
      { number: 2, label: 'Add up to four more to compare' },
      { number: 3, label: 'Tell it what matters to you' },
      { number: 4, label: 'Give it your numbers' },
      { number: 5, label: 'Generate' },
      { number: 6, label: 'Read what the report contains' },
      { number: 7, label: 'Ask the report follow-up questions' },
      { number: 8, label: 'Send it out' },
    ],
  },
] as const;

export function findInfographicTopic(
  slug: string,
): InfographicTopic | undefined {
  return INFOGRAPHIC_TOPICS.find((t) => t.slug === slug);
}

export function findInfographicTopicTask(
  topic: InfographicTopic,
  taskNumber: number,
): InfographicTopicTask | undefined {
  return topic.tasks.find((t) => t.number === taskNumber);
}

import {
  buildInfographicFocusPrompt,
  INFOGRAPHIC_FOOTER,
} from './infographic-focus-prompt';
import { INFOGRAPHIC_STYLES, findInfographicStyle } from './infographic-styles';
import {
  INFOGRAPHIC_TOPICS,
  findInfographicTopic,
  findInfographicTopicTask,
} from './infographic-topics';

function buildForVettedTopic(styleId = 'flat-editorial') {
  const topic = findInfographicTopic('mcp-for-agents');
  if (!topic) throw new Error('mcp-for-agents topic missing from registry');
  const task = findInfographicTopicTask(topic, 1);
  if (!task) throw new Error('task 1 missing from mcp-for-agents');
  const style = findInfographicStyle(styleId);
  if (!style) throw new Error(`style ${styleId} missing from registry`);
  return buildInfographicFocusPrompt({ topic, task, style });
}

describe('buildInfographicFocusPrompt targets exactly one task', () => {
  it('names the task number and label and forbids covering the others', () => {
    const prompt = buildForVettedTopic();
    expect(prompt).toContain('task 1, "Find your farm area"');
    expect(prompt).toContain('Cover ONLY that single task');
  });

  it('pins the chosen visual style descriptor verbatim', () => {
    const style = findInfographicStyle('sketch-note');
    expect(style).toBeDefined();
    const prompt = buildForVettedTopic('sketch-note');
    expect(prompt).toContain(style!.descriptor);
  });
});

describe('buildInfographicFocusPrompt carries the anti-fabrication rules', () => {
  const prompt = buildForVettedTopic();

  it('restricts facts to the source document', () => {
    expect(prompt).toContain('use ONLY facts stated in the source document');
  });

  it('pins coverage copy to the approved plus-sign figures', () => {
    expect(prompt).toContain('900+ metros, 3,000+ counties, 29,000+ ZIPs');
  });

  it('pins the single source caption line and its spellings', () => {
    expect(prompt).toContain('Zillow, Realtor.com, Census, FRED, BLS');
  });

  it('spells out the domain and names the propertylq failure mode', () => {
    expect(prompt).toContain('p-r-o-p-e-r-t-y-i-q.app');
    expect(prompt).toContain('propertylq');
  });

  it('forbids lettering on decorative objects', () => {
    expect(prompt).toContain('must carry NO text or lettering at all');
  });

  it('allows only the value 50 on a gauge', () => {
    expect(prompt).toContain('label ONLY the value 50 at its centre');
  });

  it('forbids score bands and performance statistics', () => {
    expect(prompt).toContain('NO SCORE BANDS OR PERFORMANCE STATS');
  });

  it('asks for fewer, larger text elements', () => {
    expect(prompt).toContain('prefer fewer, larger text elements');
  });

  it('ends with the exact footer line', () => {
    expect(INFOGRAPHIC_FOOTER).toBe(
      'propertyiq.app - Market-level intelligence. Not property valuation.',
    );
    expect(prompt).toContain(INFOGRAPHIC_FOOTER);
  });
});

describe('infographic registries obey the no-underscore rule', () => {
  it('emits no underscore in any generated prompt', () => {
    for (const style of INFOGRAPHIC_STYLES) {
      const prompt = buildForVettedTopic(style.id);
      expect(prompt).not.toContain('_');
    }
  });

  it('uses no underscore in any style id or label', () => {
    for (const style of INFOGRAPHIC_STYLES) {
      expect(style.id).not.toContain('_');
      expect(style.label).not.toContain('_');
    }
  });

  it('uses no underscore in any topic slug, title or task label', () => {
    for (const topic of INFOGRAPHIC_TOPICS) {
      expect(topic.slug).not.toContain('_');
      expect(topic.title).not.toContain('_');
      for (const task of topic.tasks) expect(task.label).not.toContain('_');
    }
  });
});

describe('infographic style registry', () => {
  it("carries Troy's six approved looks with unique ids", () => {
    expect(INFOGRAPHIC_STYLES).toHaveLength(6);
    const ids = INFOGRAPHIC_STYLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(6);
  });

  it('gives every style a NO-list so the model cannot freestyle', () => {
    for (const style of INFOGRAPHIC_STYLES) {
      expect(style.descriptor).toContain('VISUAL STYLE:');
      expect(style.descriptor).toContain('NO steampunk');
    }
  });
});

describe('infographic topic registry', () => {
  it('marks only mcp-for-agents as vetted', () => {
    const vetted = INFOGRAPHIC_TOPICS.filter((t) => t.vetted).map(
      (t) => t.slug,
    );
    expect(vetted).toEqual(['mcp-for-agents']);
  });

  it('gives the vetted topic a notebook and source id to generate against', () => {
    const topic = findInfographicTopic('mcp-for-agents');
    expect(topic?.notebookId).toBeTruthy();
    expect(topic?.sourceId).toBeTruthy();
  });

  it("numbers every topic's tasks from 1 with no gaps", () => {
    for (const topic of INFOGRAPHIC_TOPICS) {
      expect(topic.tasks.length).toBeGreaterThan(0);
      expect(topic.tasks.map((t) => t.number)).toEqual(
        topic.tasks.map((_, i) => i + 1),
      );
    }
  });
});

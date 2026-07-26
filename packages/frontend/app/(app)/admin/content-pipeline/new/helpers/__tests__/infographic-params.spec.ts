import { describe, it, expect } from "vitest";
import {
  buildInfographicRunPlan,
  vettedTopics,
  EMPTY_INFOGRAPHIC_SELECTION,
  type InfographicSelection,
} from "../infographic-params";
import type { InfographicOptions } from "../../../lib/infographic-options-api";

const OPTIONS: InfographicOptions = {
  topics: [
    {
      slug: "mcp-for-agents",
      title: "What agents can do with the PropertyIQ MCP",
      vetted: true,
      tasks: [
        { number: 1, label: "Find your farm area" },
        { number: 2, label: "Build a listing presentation" },
      ],
    },
    {
      slug: "how-to-map",
      title: "Using the PropertyIQ interactive map",
      vetted: false,
      tasks: [{ number: 1, label: "Pick your lens" }],
    },
  ],
  styles: [
    { id: "editorial", label: "Editorial" },
    { id: "sketch-note", label: "Sketch note" },
  ],
};

function selection(over: Partial<InfographicSelection>): InfographicSelection {
  return { ...EMPTY_INFOGRAPHIC_SELECTION, ...over };
}

describe("vettedTopics keeps drafts out of the selectable set", () => {
  it("returns only topics whose doc has been vetted", () => {
    expect(vettedTopics(OPTIONS.topics).map((t) => t.slug)).toEqual([
      "mcp-for-agents",
    ]);
  });
});

describe("buildInfographicRunPlan resolves one task into submittable params", () => {
  it("builds params and labels for a complete selection", () => {
    const plan = buildInfographicRunPlan(
      selection({
        topicSlug: "mcp-for-agents",
        taskNumber: 2,
        styleId: "sketch-note",
      }),
      OPTIONS,
    );

    expect(plan).toEqual({
      params: {
        topic_slug: "mcp-for-agents",
        task_number: 2,
        style_id: "sketch-note",
      },
      topicTitle: "What agents can do with the PropertyIQ MCP",
      taskLabel: "Build a listing presentation",
      styleLabel: "Sketch note",
      runLabel:
        "What agents can do with the PropertyIQ MCP — Build a listing presentation",
    });
  });

  it("refuses an unvetted topic even when a task and style are picked", () => {
    expect(
      buildInfographicRunPlan(
        selection({
          topicSlug: "how-to-map",
          taskNumber: 1,
          styleId: "editorial",
        }),
        OPTIONS,
      ),
    ).toBeNull();
  });

  it("refuses a selection with no task — one task per graphic is required", () => {
    expect(
      buildInfographicRunPlan(
        selection({ topicSlug: "mcp-for-agents", styleId: "editorial" }),
        OPTIONS,
      ),
    ).toBeNull();
  });

  it("refuses a task number that is not in the chosen topic", () => {
    expect(
      buildInfographicRunPlan(
        selection({
          topicSlug: "mcp-for-agents",
          taskNumber: 9,
          styleId: "editorial",
        }),
        OPTIONS,
      ),
    ).toBeNull();
  });

  it("refuses an unknown style", () => {
    expect(
      buildInfographicRunPlan(
        selection({
          topicSlug: "mcp-for-agents",
          taskNumber: 1,
          styleId: "watercolor",
        }),
        OPTIONS,
      ),
    ).toBeNull();
  });

  it("refuses an empty selection", () => {
    expect(
      buildInfographicRunPlan(EMPTY_INFOGRAPHIC_SELECTION, OPTIONS),
    ).toBeNull();
  });
});

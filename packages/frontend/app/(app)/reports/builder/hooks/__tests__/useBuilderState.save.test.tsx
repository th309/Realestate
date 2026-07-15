import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/lib/data/fetchers/reports-list");

import { useBuilderState } from "../useBuilderState";
import { saveBuilderTemplate } from "@/lib/data/fetchers/reports-list";

const mockSaveBuilderTemplate = vi.mocked(saveBuilderTemplate);

describe("useBuilderState.saveTemplate", () => {
  it("posts the current layout and clears the dirty flag on success", async () => {
    mockSaveBuilderTemplate.mockResolvedValueOnce({
      id: "tmpl-1",
      slug: "custom-x",
    });

    const { result } = renderHook(() => useBuilderState());

    act(() => {
      result.current.setUserType("investor");
      result.current.addSection("report_title");
    });
    expect(result.current.isDirty).toBe(true);

    await act(async () => {
      await result.current.saveTemplate();
    });

    expect(mockSaveBuilderTemplate).toHaveBeenCalledTimes(1);
    expect(mockSaveBuilderTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ user_type: "investor" }),
    );
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isSaving).toBe(false);
  });
});

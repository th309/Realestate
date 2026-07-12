import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetchAPIRaw = vi.fn();
vi.mock("../base", () => ({
  fetchAPIRaw: (...a: unknown[]) => mockFetchAPIRaw(...a),
}));
vi.mock("../auth-headers", () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({}),
}));

import { fetchAlertHistory } from "../alerts";

describe("fetchAlertHistory", () => {
  beforeEach(() => mockFetchAPIRaw.mockReset());

  it("reads the backend's snake_case unread_count (alerts.controller.ts), not a nonexistent camelCase field", async () => {
    mockFetchAPIRaw.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: "1",
            alert_id: "a1",
            triggered_at: "2026-07-01T00:00:00Z",
            metric_value: 500000,
            notified_via: "email",
            read_at: null,
          },
        ],
        unread_count: 3,
        count: 1,
      }),
    });

    const result = await fetchAlertHistory();
    expect(result.unreadCount).toBe(3);
    expect(result.entries).toHaveLength(1);
  });

  it("defaults unreadCount to 0 when the field is absent", async () => {
    mockFetchAPIRaw.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });

    const result = await fetchAlertHistory();
    expect(result.unreadCount).toBe(0);
  });

  it("returns empty entries + 0 unread on a failed response", async () => {
    mockFetchAPIRaw.mockResolvedValue({ ok: false });

    const result = await fetchAlertHistory();
    expect(result).toEqual({ entries: [], unreadCount: 0 });
  });
});

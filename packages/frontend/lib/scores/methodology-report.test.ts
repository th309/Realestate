import {
  readMethodologyReport,
  resolveMethodologyReportPath,
} from "./methodology-report";

describe("methodology report reader", () => {
  it("resolves an existing path ending in validation-report.md", () => {
    expect(resolveMethodologyReportPath()).toMatch(/validation-report\.md$/);
  });

  it("reads non-empty markdown", () => {
    expect(readMethodologyReport().length).toBeGreaterThan(100);
  });
});

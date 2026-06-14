import { type TestJob } from "./test-runner-config";
import { StatusBadge } from "./StatusBadge";

export function TestJobTable({
  jobs,
  currentIdx,
}: {
  jobs: TestJob[];
  currentIdx: number;
}) {
  return (
    <div className="rounded-xl border border-outline-variant overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-surface-container text-on-surface-variant text-left">
            <th className="px-3 py-2 font-medium">Test Run ID</th>
            <th className="px-3 py-2 font-medium">Model</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Geo</th>
            <th className="px-3 py-2 font-medium">Time</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job, i) => (
            <tr
              key={job.testRunId}
              className={`border-t border-outline-variant ${
                i === currentIdx ? "bg-primary/5" : ""
              }`}
            >
              <td className="px-3 py-2 font-mono">
                <span className="text-primary">{job.testRunId}</span>
                {job.reportId && (
                  <a
                    href={`/reports/${job.reportId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-xs text-blue-600 hover:underline"
                  >
                    View Report →
                  </a>
                )}
              </td>
              <td className="px-3 py-2">{job.model.shortName}</td>
              <td className="px-3 py-2">{job.reportType.label}</td>
              <td className="px-3 py-2">{job.geography.shortName}</td>
              <td className="px-3 py-2 font-mono text-xs text-on-surface-variant">
                {job.elapsed || "—"}
              </td>
              <td className="px-3 py-2">
                <StatusBadge
                  status={job.status}
                  error={job.error}
                  elapsed={job.elapsed}
                  stage={job.stage}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

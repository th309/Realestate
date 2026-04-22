export default function PerformancePage() {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <div className="p-8 max-w-3xl">
        <h1 className="text-2xl font-semibold mb-4 text-on-surface">
          Performance
        </h1>
        <div className="rounded-xl bg-surface-container-low p-8 text-center shadow-sm">
          <p className="text-on-surface-variant mb-3">
            Performance analytics ship in Phase 4.
          </p>
          <p className="text-sm text-on-surface-variant">
            Until then, view individual run metrics on the run detail page.
          </p>
        </div>
      </div>
    </div>
  );
}

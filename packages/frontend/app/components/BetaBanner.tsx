/** "Coming Soon" beta tester banner. */
export function BetaBanner() {
  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2.5 text-center">
      <p className="text-sm font-medium text-on-surface">
        <span className="inline-flex items-center gap-2">
          <span className="bg-primary text-on-primary text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
            Coming Soon
          </span>
          <span className="text-on-surface-variant">
            PropertyIQ is launching shortly. Become a beta tester and get 3
            months of Pro access in exchange for your feedback &mdash; reach out
            at{" "}
            <a
              href="mailto:betatesters@propertyiq.app"
              className="text-primary hover:text-primary/80 font-semibold underline underline-offset-2"
            >
              betatesters@propertyiq.app
            </a>
          </span>
        </span>
      </p>
    </div>
  );
}

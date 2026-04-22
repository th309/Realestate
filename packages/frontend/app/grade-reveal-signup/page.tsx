import Link from "next/link";

export default function GradeRevealSignupPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 max-w-2xl mx-auto">
      <h1 className="text-4xl font-bold text-primary-dark text-center mb-4">
        Get your free Market Snapshot
      </h1>
      <p className="text-lg text-center text-outline mb-8">
        See the PropertyIQ Score, home value trend, and key metrics for any
        metro.
      </p>

      <form
        action="/api/auth/signup"
        method="POST"
        className="w-full bg-surface-container-low rounded-xl p-6 shadow-sm space-y-4"
      >
        <input
          type="text"
          name="marketQuery"
          placeholder="Which metro?"
          required
          className="w-full rounded-lg border border-outline-variant p-3"
        />
        <input
          type="email"
          name="email"
          placeholder="Email for your PDF"
          required
          className="w-full rounded-lg border border-outline-variant p-3"
        />
        <input type="hidden" name="magnetKind" value="market_snapshot_pdf" />
        <button
          type="submit"
          className="w-full bg-primary text-on-primary rounded-full py-3 font-semibold"
        >
          Get Free Snapshot
        </button>
      </form>

      <p className="text-xs text-outline mt-6 text-center">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}

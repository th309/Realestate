import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PropertyIQ Scores',
  description: 'AI-powered scores that predict real estate market performance, validated across 1.1M+ observations.',
};

export default function ScoresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {children}
      </div>
    </div>
  );
}

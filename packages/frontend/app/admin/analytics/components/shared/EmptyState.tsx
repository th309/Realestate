/**
 * EmptyState
 *
 * Contextual empty state with icon, message, and suggestion.
 * M3 surface styling with muted colors.
 */

import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center mb-4 text-on-surface-variant">
        {icon ?? <Inbox className="w-6 h-6" />}
      </div>
      <h3 className="text-base font-medium text-on-surface mb-1">{title}</h3>
      <p className="text-sm text-on-surface-variant max-w-sm">{description}</p>
    </div>
  );
}

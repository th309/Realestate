'use client';

import React, { useState } from 'react';
import {
  Zap,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit2,
  ChevronRight,
  AlertCircle,
  Mail,
  Tag,
  UserPlus,
  Clock,
  ArrowRight,
  CheckCircle,
  X,
} from 'lucide-react';

// Types
type TriggerType = 'paywall_hit' | 'trial_expiring' | 'inactive' | 'tier_change' | 'signup';
type ActionType = 'send_email' | 'add_tag' | 'start_trial' | 'notify_slack' | 'change_tier';

interface AutomationTrigger {
  type: TriggerType;
  condition: string;
  value?: number;
}

interface AutomationAction {
  type: ActionType;
  config: Record<string, unknown>;
}

interface Automation {
  id: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  isEnabled: boolean;
  lastTriggered?: string;
  triggerCount: number;
}

// Mock data
const MOCK_AUTOMATIONS: Automation[] = [
  {
    id: '1',
    name: 'High-Intent Follow-up',
    description: 'Send upgrade email when user hits 5+ paywalls',
    trigger: { type: 'paywall_hit', condition: 'gte', value: 5 },
    actions: [
      { type: 'send_email', config: { template: 'high_intent_upgrade' } },
      { type: 'add_tag', config: { tag: 'high_intent' } },
    ],
    isEnabled: true,
    lastTriggered: '2026-02-07T10:30:00Z',
    triggerCount: 47,
  },
  {
    id: '2',
    name: 'Trial Expiration Reminder',
    description: 'Send reminder email 3 days before trial expires',
    trigger: { type: 'trial_expiring', condition: 'days_remaining', value: 3 },
    actions: [
      { type: 'send_email', config: { template: 'trial_expiring' } },
    ],
    isEnabled: true,
    lastTriggered: '2026-02-06T08:00:00Z',
    triggerCount: 23,
  },
  {
    id: '3',
    name: 'Churn Risk Alert',
    description: 'Tag Pro users who haven\'t logged in for 30 days',
    trigger: { type: 'inactive', condition: 'days', value: 30 },
    actions: [
      { type: 'add_tag', config: { tag: 'churn_risk' } },
      { type: 'notify_slack', config: { channel: '#revenue' } },
    ],
    isEnabled: false,
    triggerCount: 12,
  },
  {
    id: '4',
    name: 'New User Trial',
    description: 'Auto-start trial for new users from certain referrers',
    trigger: { type: 'signup', condition: 'referrer_contains', value: 'bigpockets' },
    actions: [
      { type: 'start_trial', config: { duration: 14, tier: 'pro' } },
      { type: 'send_email', config: { template: 'trial_started' } },
    ],
    isEnabled: true,
    lastTriggered: '2026-02-07T14:22:00Z',
    triggerCount: 89,
  },
];

const TRIGGER_LABELS: Record<TriggerType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  paywall_hit: { label: 'Paywall Hit', icon: AlertCircle },
  trial_expiring: { label: 'Trial Expiring', icon: Clock },
  inactive: { label: 'User Inactive', icon: Clock },
  tier_change: { label: 'Tier Changed', icon: UserPlus },
  signup: { label: 'User Signup', icon: UserPlus },
};

const ACTION_LABELS: Record<ActionType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  send_email: { label: 'Send Email', icon: Mail },
  add_tag: { label: 'Add Tag', icon: Tag },
  start_trial: { label: 'Start Trial', icon: Zap },
  notify_slack: { label: 'Notify Slack', icon: Zap },
  change_tier: { label: 'Change Tier', icon: UserPlus },
};

// Components
function TriggerBadge({ trigger }: { trigger: AutomationTrigger }) {
  const config = TRIGGER_LABELS[trigger.type];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm">
      <Icon className="w-4 h-4" />
      <span>{config.label}</span>
      {trigger.value && (
        <span className="font-medium">
          {trigger.condition === 'gte' && `≥ ${trigger.value}`}
          {trigger.condition === 'days_remaining' && `${trigger.value} days`}
          {trigger.condition === 'days' && `${trigger.value} days`}
        </span>
      )}
    </div>
  );
}

function ActionBadge({ action }: { action: AutomationAction }) {
  const config = ACTION_LABELS[action.type];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm">
      <Icon className="w-4 h-4" />
      <span>{config.label}</span>
    </div>
  );
}

function AutomationCard({
  automation,
  onToggle,
  onDelete,
}: {
  automation: Automation;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`
        bg-surface-container rounded-xl border transition-all
        ${automation.isEnabled
          ? 'border-outline-variant'
          : 'border-outline-variant opacity-60'
        }
      `}
    >
      {/* Header */}
      <div
        className="flex items-center gap-4 p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={`
            w-10 h-10 rounded-lg flex items-center justify-center transition-colors
            ${automation.isEnabled
              ? 'bg-green-100 text-green-700'
              : 'bg-surface-container-high text-on-surface-variant'
            }
          `}
        >
          {automation.isEnabled ? (
            <Play className="w-5 h-5" />
          ) : (
            <Pause className="w-5 h-5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-on-surface">
              {automation.name}
            </span>
            {!automation.isEnabled && (
              <span className="text-xs bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded">
                Paused
              </span>
            )}
          </div>
          <span className="text-sm text-on-surface-variant line-clamp-1">
            {automation.description}
          </span>
        </div>

        <div className="flex items-center gap-6 text-sm text-on-surface-variant">
          <div className="text-center">
            <div className="font-medium text-on-surface">
              {automation.triggerCount}
            </div>
            <div className="text-xs">Triggers</div>
          </div>
          <ChevronRight
            className={`w-5 h-5 transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`}
          />
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-outline-variant p-4 space-y-4">
          {/* Flow Visualization */}
          <div className="flex items-center gap-3 flex-wrap">
            <TriggerBadge trigger={automation.trigger} />
            <ArrowRight className="w-4 h-4 text-on-surface-variant" />
            {automation.actions.map((action, i) => (
              <React.Fragment key={i}>
                <ActionBadge action={action} />
                {i < automation.actions.length - 1 && (
                  <Plus className="w-4 h-4 text-on-surface-variant" />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Stats */}
          {automation.lastTriggered && (
            <div className="text-sm text-on-surface-variant">
              Last triggered:{' '}
              {new Date(automation.lastTriggered).toLocaleString()}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button className="flex items-center gap-2 px-3 py-2 bg-surface-container-high text-on-surface rounded-lg text-sm hover:bg-surface-container transition-colors">
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
            <button className="flex items-center gap-2 px-3 py-2 bg-surface-container-high text-on-surface rounded-lg text-sm hover:bg-surface-container transition-colors">
              <Play className="w-4 h-4" />
              Test
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-2 px-3 py-2 bg-surface-container-high text-red-600 rounded-lg text-sm hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Create Automation Modal placeholder
function CreateAutomationButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="
        flex items-center gap-2 px-4 py-2
        bg-primary text-on-primary rounded-lg
        hover:bg-primary/90 transition-colors
      "
    >
      <Plus className="w-4 h-4" />
      Create Automation
    </button>
  );
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>(MOCK_AUTOMATIONS);
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all');

  const filteredAutomations = automations.filter((a) => {
    if (filter === 'active') return a.isEnabled;
    if (filter === 'paused') return !a.isEnabled;
    return true;
  });

  const handleToggle = (id: string) => {
    setAutomations((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, isEnabled: !a.isEnabled } : a
      )
    );
  };

  const handleDelete = (id: string) => {
    setAutomations((prev) => prev.filter((a) => a.id !== id));
  };

  const activeCount = automations.filter((a) => a.isEnabled).length;
  const totalTriggers = automations.reduce((sum, a) => sum + a.triggerCount, 0);

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">Automations</h1>
          <p className="text-on-surface-variant">
            Create rules to automate user engagement and tier management
          </p>
        </div>
        <CreateAutomationButton onClick={() => console.log('Create automation')} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-surface-container rounded-lg p-4">
          <div className="text-2xl font-semibold text-on-surface">
            {automations.length}
          </div>
          <div className="text-sm text-on-surface-variant">Total Automations</div>
        </div>
        <div className="bg-surface-container rounded-lg p-4">
          <div className="text-2xl font-semibold text-green-600">
            {activeCount}
          </div>
          <div className="text-sm text-on-surface-variant">Active</div>
        </div>
        <div className="bg-surface-container rounded-lg p-4">
          <div className="text-2xl font-semibold text-on-surface">
            {totalTriggers.toLocaleString()}
          </div>
          <div className="text-sm text-on-surface-variant">Total Triggers</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'active', 'paused'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`
              px-4 py-2 rounded-lg text-sm transition-colors
              ${filter === f
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }
            `}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span className="ml-1.5 opacity-70">
                ({f === 'active' ? activeCount : automations.length - activeCount})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Automations List */}
      <div className="space-y-4">
        {filteredAutomations.map((automation) => (
          <AutomationCard
            key={automation.id}
            automation={automation}
            onToggle={() => handleToggle(automation.id)}
            onDelete={() => handleDelete(automation.id)}
          />
        ))}

        {filteredAutomations.length === 0 && (
          <div className="text-center py-12 bg-surface-container rounded-xl">
            <Zap className="w-12 h-12 text-on-surface-variant mx-auto mb-3" />
            <p className="text-on-surface-variant">No automations found</p>
          </div>
        )}
      </div>

      {/* Automation Ideas */}
      <div className="mt-8 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
        <h3 className="text-lg font-medium text-purple-900 mb-4">
          Automation Ideas
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              title: 'Win-back Campaign',
              description: 'Email churned Pro users after 30 days with a discount offer',
            },
            {
              title: 'Feature Adoption',
              description: 'Prompt users who haven\'t tried key features',
            },
            {
              title: 'Usage Milestone',
              description: 'Celebrate when users hit usage milestones',
            },
            {
              title: 'Referral Reward',
              description: 'Grant feature access when users refer others',
            },
          ].map((idea, i) => (
            <div
              key={i}
              className="bg-white/50 rounded-lg p-4 border border-purple-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-purple-900">{idea.title}</div>
                  <div className="text-sm text-purple-700">{idea.description}</div>
                </div>
                <button className="text-xs text-purple-600 hover:underline">
                  Create
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

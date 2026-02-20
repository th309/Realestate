'use client';

import React from 'react';
import {
  Zap,
  Mail,
  Tag,
  UserPlus,
  Clock,
  ArrowRight,
  Bell,
  AlertCircle,
} from 'lucide-react';

// Planned automation types for reference
const PLANNED_TRIGGERS = [
  { type: 'paywall_hit', label: 'Paywall Hit', icon: AlertCircle, description: 'When user hits X paywalls' },
  { type: 'trial_expiring', label: 'Trial Expiring', icon: Clock, description: 'N days before trial ends' },
  { type: 'inactive', label: 'User Inactive', icon: Clock, description: 'User inactive for N days' },
  { type: 'tier_change', label: 'Tier Changed', icon: UserPlus, description: 'When user upgrades/downgrades' },
  { type: 'signup', label: 'User Signup', icon: UserPlus, description: 'New user registration' },
];

const PLANNED_ACTIONS = [
  { type: 'send_email', label: 'Send Email', icon: Mail, description: 'Send templated email' },
  { type: 'add_tag', label: 'Add Tag', icon: Tag, description: 'Add user segment tag' },
  { type: 'start_trial', label: 'Start Trial', icon: Zap, description: 'Auto-start trial' },
  { type: 'notify_slack', label: 'Notify Slack', icon: Bell, description: 'Send Slack notification' },
  { type: 'change_tier', label: 'Change Tier', icon: UserPlus, description: 'Update user tier' },
];

export default function AutomationsPage() {
  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-semibold text-on-surface">Automations</h1>
          <span className="px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded-full">
            Coming Soon
          </span>
        </div>
        <p className="text-on-surface-variant">
          Create rules to automate user engagement and tier management
        </p>
      </div>

      {/* Coming Soon Banner */}
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-8 border border-primary/20 mb-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-on-surface mb-2">
              Automations are under development
            </h2>
            <p className="text-on-surface-variant mb-4">
              We're building a powerful automation engine that will let you create
              rules to automatically engage users based on their behavior. This
              feature requires event processing infrastructure and email integrations.
            </p>
            <div className="flex items-center gap-2 text-sm text-primary">
              <Clock className="w-4 h-4" />
              <span>Expected Q2 2026</span>
            </div>
          </div>
        </div>
      </div>

      {/* Preview: Triggers */}
      <div className="mb-8">
        <h3 className="text-lg font-medium text-on-surface mb-4">Planned Triggers</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PLANNED_TRIGGERS.map((trigger) => {
            const Icon = trigger.icon;
            return (
              <div
                key={trigger.type}
                className="flex items-center gap-3 p-4 bg-surface-container rounded-lg border border-outline-variant opacity-75"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-on-surface">{trigger.label}</div>
                  <div className="text-xs text-on-surface-variant">{trigger.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preview: Actions */}
      <div className="mb-8">
        <h3 className="text-lg font-medium text-on-surface mb-4">Planned Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PLANNED_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <div
                key={action.type}
                className="flex items-center gap-3 p-4 bg-surface-container rounded-lg border border-outline-variant opacity-75"
              >
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-on-surface">{action.label}</div>
                  <div className="text-xs text-on-surface-variant">{action.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Example Flow */}
      <div className="bg-surface-container rounded-xl p-6 border border-outline-variant">
        <h3 className="text-lg font-medium text-on-surface mb-4">Example: High-Intent Follow-up</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>Paywall Hit ≥ 5</span>
          </div>
          <ArrowRight className="w-4 h-4 text-on-surface-variant" />
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm">
            <Mail className="w-4 h-4" />
            <span>Send Email</span>
          </div>
          <span className="text-on-surface-variant">+</span>
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm">
            <Tag className="w-4 h-4" />
            <span>Add Tag: high_intent</span>
          </div>
        </div>
        <p className="text-sm text-on-surface-variant mt-4">
          Automatically send an upgrade email and tag users who hit 5 or more paywalls,
          indicating high interest in premium features.
        </p>
      </div>

      {/* Feature Requests */}
      <div className="mt-8 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
        <h3 className="text-lg font-medium text-purple-900 mb-3">
          Have automation ideas?
        </h3>
        <p className="text-sm text-purple-700 mb-4">
          We'd love to hear what automations would be most valuable for your workflow.
        </p>
        <button className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors">
          Share Feedback
        </button>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Bell, Mail, TrendingUp, Megaphone } from 'lucide-react';
import { PageHeaderWithBreadcrumbs } from '@/components/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface EmailPreferences {
  weekly_digest: boolean;
  alert_emails: boolean;
  marketing: boolean;
}

export default function NotificationsPage() {
  const [prefs, setPrefs] = useState<EmailPreferences>({
    weekly_digest: true,
    alert_emails: true,
    marketing: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/email/preferences`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setPrefs({
          weekly_digest: data.weekly_digest ?? true,
          alert_emails: data.alert_emails ?? true,
          marketing: data.marketing ?? false,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleToggle = async (key: keyof EmailPreferences) => {
    const newValue = !prefs[key];
    setPrefs(prev => ({ ...prev, [key]: newValue }));
    setSaving(true);

    await fetch(`${API_URL}/api/email/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ [key]: newValue }),
    });

    setSaving(false);
  };

  const toggleItems = [
    {
      key: 'weekly_digest' as const,
      icon: <Mail className="w-5 h-5 text-primary" />,
      title: 'Weekly Digest',
      description: 'A summary of your saved markets, score changes, and triggered alerts every Monday.',
    },
    {
      key: 'alert_emails' as const,
      icon: <TrendingUp className="w-5 h-5 text-primary" />,
      title: 'Alert Notifications',
      description: 'Get notified by email when your market alerts are triggered.',
    },
    {
      key: 'marketing' as const,
      icon: <Megaphone className="w-5 h-5 text-on-surface-variant" />,
      title: 'Product Updates',
      description: 'Occasional updates about new features and improvements.',
    },
  ];

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <PageHeaderWithBreadcrumbs
          breadcrumbs={[
            { label: 'Account', href: '/account' },
            { label: 'Notifications' },
          ]}
          title="Notification Preferences"
          description="Choose which emails you'd like to receive"
          icon={<Bell className="w-5 h-5" />}
        />

        <div className="mt-8 space-y-1">
          {toggleItems.map(item => (
            <div
              key={item.key}
              className="flex items-center gap-4 p-4 bg-surface-container rounded-xl border border-outline-variant"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-on-surface">{item.title}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">{item.description}</p>
              </div>
              <button
                onClick={() => handleToggle(item.key)}
                disabled={loading}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  prefs[item.key] ? 'bg-primary' : 'bg-surface-container-highest'
                } ${loading ? 'opacity-50' : ''}`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    prefs[item.key] ? 'translate-x-[22px]' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        {saving && (
          <p className="text-xs text-on-surface-variant mt-4 text-center">Saving...</p>
        )}
      </div>
    </div>
  );
}

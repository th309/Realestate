'use client';

/**
 * Share Dialog Component
 *
 * Modal for creating shareable links.
 */

import React, { useState } from 'react';
import { X, Link2, Copy, Check, Lock, Mail, Calendar, Eye } from 'lucide-react';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onShare: (options: ShareOptions) => Promise<string | null>;
  contentType: 'query_result' | 'comparison' | 'chart' | 'conversation';
  title?: string;
}

interface ShareOptions {
  title?: string;
  description?: string;
  is_public: boolean;
  password?: string;
  allowed_emails?: string[];
  expires_in_days?: number;
  max_views?: number;
}

export function ShareDialog({
  isOpen,
  onClose,
  onShare,
  contentType,
  title: defaultTitle,
}: ShareDialogProps) {
  const [title, setTitle] = useState(defaultTitle || '');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [password, setPassword] = useState('');
  const [allowedEmails, setAllowedEmails] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | ''>('');
  const [maxViews, setMaxViews] = useState<number | ''>('');

  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleShare = async () => {
    setIsSharing(true);

    const options: ShareOptions = {
      title: title || undefined,
      description: description || undefined,
      is_public: isPublic,
      password: password || undefined,
      allowed_emails: allowedEmails
        ? allowedEmails.split(',').map((e) => e.trim()).filter(Boolean)
        : undefined,
      expires_in_days: expiresInDays || undefined,
      max_views: maxViews || undefined,
    };

    const url = await onShare(options);
    setShareUrl(url);
    setIsSharing(false);
  };

  const handleCopy = async () => {
    if (!shareUrl) return;

    const fullUrl = `${window.location.origin}${shareUrl}`;
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setShareUrl(null);
    setCopied(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Dialog */}
      <div className="relative bg-surface rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-on-surface">
              {shareUrl ? 'Link Created!' : 'Create Shareable Link'}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {shareUrl ? (
          /* Success state */
          <div className="space-y-4">
            <p className="text-sm text-on-surface-variant">
              Your shareable link is ready. Anyone with this link can view the content.
            </p>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}${shareUrl}`}
                className="flex-1 px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-on-surface text-sm"
              />
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>

            <button
              onClick={handleClose}
              className="w-full py-2 text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          /* Form state */
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1.5">
                Title (optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Texas Metro Comparison"
                className="w-full px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1.5">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add context for viewers..."
                rows={2}
                className="w-full px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary resize-none"
              />
            </div>

            {/* Security options */}
            <div className="space-y-3 pt-2 border-t border-outline-variant">
              <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">
                Security
              </p>

              {/* Password */}
              <div className="flex items-center gap-3">
                <Lock className="w-4 h-4 text-on-surface-variant" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password protect (optional)"
                  className="flex-1 px-3 py-1.5 bg-surface-container border border-outline-variant rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary"
                />
              </div>

              {/* Allowed emails */}
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-on-surface-variant" />
                <input
                  type="text"
                  value={allowedEmails}
                  onChange={(e) => setAllowedEmails(e.target.value)}
                  placeholder="Restrict to emails (comma separated)"
                  className="flex-1 px-3 py-1.5 bg-surface-container border border-outline-variant rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary"
                />
              </div>

              {/* Expiration */}
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-on-surface-variant" />
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value ? parseInt(e.target.value) : '')}
                  className="flex-1 px-3 py-1.5 bg-surface-container border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                >
                  <option value="">Never expires</option>
                  <option value="1">1 day</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                </select>
              </div>

              {/* View limit */}
              <div className="flex items-center gap-3">
                <Eye className="w-4 h-4 text-on-surface-variant" />
                <input
                  type="number"
                  value={maxViews}
                  onChange={(e) => setMaxViews(e.target.value ? parseInt(e.target.value) : '')}
                  placeholder="Max views (unlimited)"
                  min="1"
                  className="flex-1 px-3 py-1.5 bg-surface-container border border-outline-variant rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleShare}
                disabled={isSharing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Link2 className="w-4 h-4" />
                {isSharing ? 'Creating...' : 'Create Link'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

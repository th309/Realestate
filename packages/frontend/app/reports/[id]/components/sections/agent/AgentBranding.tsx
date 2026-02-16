'use client';

import React from 'react';

import type { ReportInstance } from '../../../../types';

export interface AgentBrandingProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Agent info shape expected from report data.
 */
interface AgentInfo {
  name?: string;
  brokerage?: string;
  phone?: string;
  email?: string;
  photo_url?: string;
  license_number?: string;
}

/**
 * AgentBranding - Agent branding footer for client-facing reports
 *
 * Displays the agent's photo, name, brokerage, contact details, and license
 * number. Returns null if no agent info is available. Styled with the
 * navy/cream editorial theme.
 */
export function AgentBranding({
  report,
  className = '',
}: AgentBrandingProps): React.ReactElement | null {
  // Resolve agent info from multiple possible locations
  const agentInfo: AgentInfo | undefined =
    (report.user_inputs?.agent_info as AgentInfo | undefined) ??
    ((report as any).agent_info as AgentInfo | undefined);

  // Return null if no agent info exists
  if (!agentInfo || (!agentInfo.name && !agentInfo.brokerage)) {
    return null;
  }

  return (
    <section
      className={`report-animate-in ${className}`.trim()}
      style={{
        padding: 'var(--report-space-lg)',
        borderRadius: 'var(--report-radius-lg)',
        backgroundColor: 'var(--report-navy)',
        color: 'white',
      }}
      aria-label="Agent information"
    >
      {/* "Prepared for you by" header */}
      <p
        style={{
          fontFamily: 'var(--report-font-body)',
          fontSize: '0.6875rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'rgba(255, 255, 255, 0.5)',
          marginBottom: 'var(--report-space-md)',
        }}
      >
        Prepared for you by
      </p>

      {/* Agent Card Layout */}
      <div className="flex items-start gap-[var(--report-space-md)]">
        {/* Agent Photo */}
        {agentInfo.photo_url && (
          <div
            className="flex-shrink-0 overflow-hidden"
            style={{
              width: '64px',
              height: '64px',
              borderRadius: 'var(--report-radius-md)',
              border: '2px solid rgba(255, 255, 255, 0.15)',
            }}
          >
            <img
              src={agentInfo.photo_url}
              alt={agentInfo.name ? `${agentInfo.name} headshot` : 'Agent headshot'}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Agent Details */}
        <div className="flex-1 min-w-0">
          {/* Name */}
          {agentInfo.name && (
            <p
              style={{
                fontFamily: 'var(--report-font-display)',
                fontSize: '1.125rem',
                fontWeight: 700,
                color: 'white',
                margin: 0,
                marginBottom: '2px',
              }}
            >
              {agentInfo.name}
            </p>
          )}

          {/* Brokerage */}
          {agentInfo.brokerage && (
            <p
              style={{
                fontFamily: 'var(--report-font-body)',
                fontSize: '0.875rem',
                color: 'rgba(255, 255, 255, 0.7)',
                margin: 0,
                marginBottom: 'var(--report-space-sm)',
              }}
            >
              {agentInfo.brokerage}
            </p>
          )}

          {/* Contact Info */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {agentInfo.phone && (
              <a
                href={`tel:${agentInfo.phone}`}
                style={{
                  fontFamily: 'var(--report-font-body)',
                  fontSize: '0.8125rem',
                  color: 'rgba(255, 255, 255, 0.8)',
                  textDecoration: 'none',
                }}
                className="hover:underline"
              >
                {agentInfo.phone}
              </a>
            )}
            {agentInfo.email && (
              <a
                href={`mailto:${agentInfo.email}`}
                style={{
                  fontFamily: 'var(--report-font-body)',
                  fontSize: '0.8125rem',
                  color: 'rgba(255, 255, 255, 0.8)',
                  textDecoration: 'none',
                }}
                className="hover:underline"
              >
                {agentInfo.email}
              </a>
            )}
          </div>

          {/* License Number */}
          {agentInfo.license_number && (
            <p
              style={{
                fontFamily: 'var(--report-font-body)',
                fontSize: '0.6875rem',
                color: 'rgba(255, 255, 255, 0.4)',
                margin: 0,
                marginTop: 'var(--report-space-xs)',
              }}
            >
              License #{agentInfo.license_number}
            </p>
          )}
        </div>
      </div>

      {/* Powered By Footer */}
      <div
        style={{
          marginTop: 'var(--report-space-lg)',
          paddingTop: 'var(--report-space-sm)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--report-font-body)',
            fontSize: '0.625rem',
            color: 'rgba(255, 255, 255, 0.3)',
            margin: 0,
            textAlign: 'right',
          }}
        >
          Powered by PropertyIQ
        </p>
      </div>
    </section>
  );
}

export default AgentBranding;

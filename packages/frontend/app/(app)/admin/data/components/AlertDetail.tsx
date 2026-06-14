/**
 * AlertDetail Component
 *
 * Displays detailed information about a selected alert with action buttons.
 * Material Design 3 compliant.
 */

'use client';

import React from 'react';
import {
  DataAlert,
  getSeverityColor,
  getAlertTypeLabel,
  formatAlertDate,
} from './dataAlerts.types';

interface AlertDetailProps {
  alert: DataAlert;
  onAcknowledge: (alertId: string) => void;
  onResolve: (alertId: string) => void;
}

export function AlertDetail({ alert, onAcknowledge, onResolve }: AlertDetailProps) {
  return (
    <div className="bg-surface-container rounded-xl p-6 space-y-4 h-fit sticky top-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-on-surface">{alert.title}</h3>
          <p className="text-sm text-on-surface-variant">
            {getAlertTypeLabel(alert.alertType)}
          </p>
        </div>
        <span
          className={`text-sm px-3 py-1 rounded-full border ${getSeverityColor(alert.severity)}`}
        >
          {alert.severity}
        </span>
      </div>

      <div className="p-4 rounded-lg bg-surface-container-low">
        <p className="text-on-surface">{alert.message}</p>
      </div>

      {alert.sourceName && (
        <div className="text-sm">
          <span className="text-on-surface-variant">Source: </span>
          <span className="text-on-surface font-medium">{alert.sourceName}</span>
        </div>
      )}

      {alert.pipelineName && (
        <div className="text-sm">
          <span className="text-on-surface-variant">Pipeline: </span>
          <span className="text-on-surface font-medium">{alert.pipelineName}</span>
        </div>
      )}

      <div className="text-sm">
        <span className="text-on-surface-variant">Created: </span>
        <span className="text-on-surface">{formatAlertDate(alert.createdAt)}</span>
      </div>

      {alert.acknowledgedAt && (
        <div className="text-sm">
          <span className="text-on-surface-variant">Acknowledged: </span>
          <span className="text-on-surface">
            {formatAlertDate(alert.acknowledgedAt)}
            {alert.acknowledgedBy && ` by ${alert.acknowledgedBy}`}
          </span>
        </div>
      )}

      {/* Actions for open alerts */}
      {alert.status === 'open' && (
        <div className="flex gap-3 pt-4 border-t border-outline-variant">
          <button
            onClick={() => onAcknowledge(alert.id)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-secondary text-on-secondary"
            data-testid="acknowledge-button"
          >
            Acknowledge
          </button>
          <button
            onClick={() => onResolve(alert.id)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-on-primary"
            data-testid="resolve-button"
          >
            Resolve
          </button>
        </div>
      )}

      {/* Actions for acknowledged alerts */}
      {alert.status === 'acknowledged' && (
        <div className="flex gap-3 pt-4 border-t border-outline-variant">
          <button
            onClick={() => onResolve(alert.id)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-on-primary"
            data-testid="resolve-button"
          >
            Resolve
          </button>
        </div>
      )}
    </div>
  );
}

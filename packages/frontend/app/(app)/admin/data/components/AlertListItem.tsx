/**
 * AlertListItem Component
 *
 * Renders a single alert item in the alerts list.
 * Material Design 3 compliant.
 */

'use client';

import React from 'react';
import {
  DataAlert,
  getSeverityColor,
  getStatusColor,
  formatAlertDate,
} from './dataAlerts.types';

interface AlertListItemProps {
  alert: DataAlert;
  isSelected: boolean;
  onSelect: (alert: DataAlert) => void;
}

export function AlertListItem({ alert, isSelected, onSelect }: AlertListItemProps) {
  return (
    <button
      onClick={() => onSelect(alert)}
      className={`
        w-full p-4 text-left rounded-xl transition-all duration-200
        ${
          isSelected
            ? 'ring-2 ring-primary bg-primary-container'
            : 'bg-surface-container hover:bg-surface-container-high'
        }
      `}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2 py-0.5 rounded-full border ${getSeverityColor(alert.severity)}`}
          >
            {alert.severity}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(alert.status)}`}>
            {alert.status}
          </span>
        </div>
        <span className="text-xs text-on-surface-variant">
          {formatAlertDate(alert.createdAt)}
        </span>
      </div>

      <div className="font-medium text-on-surface mb-1">{alert.title}</div>
      <div className="text-sm text-on-surface-variant">{alert.message}</div>
    </button>
  );
}

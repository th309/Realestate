'use client';

import React from 'react';
import { Home, TrendingUp } from 'lucide-react';
import type { UserType } from '../../types';
import { USER_TYPE_CONFIG } from '../../constants';

interface UserTypeToggleProps {
  value: UserType;
  onChange: (type: UserType) => void;
}

const icons = {
  Home,
  TrendingUp,
};

export const UserTypeToggle: React.FC<UserTypeToggleProps> = ({ value, onChange }) => {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-on-surface mb-3">
        What brings you here today?
      </label>
      <div className="grid grid-cols-2 gap-3">
        {(Object.entries(USER_TYPE_CONFIG) as [UserType, typeof USER_TYPE_CONFIG.homebuyer][]).map(
          ([type, config]) => {
            const isSelected = value === type;
            const Icon = icons[config.icon as keyof typeof icons];

            return (
              <button
                key={type}
                onClick={() => onChange(type)}
                className={`
                  relative p-4 rounded-2xl text-left transition-all duration-200
                  ${
                    isSelected
                      ? 'bg-primary-container border-2 border-primary'
                      : 'bg-surface-container border-2 border-transparent hover:border-outline-variant'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`
                      p-2 rounded-xl
                      ${isSelected ? 'bg-primary/20' : 'bg-surface-container-high'}
                    `}
                  >
                    <Icon
                      className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-on-surface-variant'}`}
                    />
                  </div>
                  <div>
                    <div
                      className={`
                        font-medium text-sm
                        ${isSelected ? 'text-on-primary-container' : 'text-on-surface'}
                      `}
                    >
                      {config.label}
                    </div>
                    <div
                      className={`
                        text-xs mt-0.5
                        ${isSelected ? 'text-on-primary-container/70' : 'text-on-surface-variant'}
                      `}
                    >
                      {config.description}
                    </div>
                  </div>
                </div>

                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary" />
                )}
              </button>
            );
          }
        )}
      </div>
    </div>
  );
};

'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign,
  TrendingUp,
  Briefcase,
  Clock,
  Heart,
  BarChart3,
  Users,
  Shield,
  type LucideIcon
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type HomebuyerPriorityId = 'affordability' | 'appreciation' | 'job_market' | 'market_timing' | 'lifestyle';
type InvestorPriorityId = 'cash_flow' | 'appreciation' | 'tenant_demand' | 'entry_price' | 'stability';
type PriorityId = HomebuyerPriorityId | InvestorPriorityId;

interface PriorityOption {
  id: PriorityId;
  label: string;
  description: string;
  icon: LucideIcon;
}

export interface PrioritySelectorProps {
  userType: 'homebuyer' | 'investor';
  selected: string[];
  onChange: (priorities: string[]) => void;
}

// ============================================================================
// PRIORITY DEFINITIONS
// ============================================================================

const HOMEBUYER_PRIORITIES: PriorityOption[] = [
  {
    id: 'affordability',
    label: 'Affordability',
    description: 'Can I afford to buy here?',
    icon: DollarSign
  },
  {
    id: 'appreciation',
    label: 'Appreciation',
    description: 'Will my home grow in value?',
    icon: TrendingUp
  },
  {
    id: 'job_market',
    label: 'Job Market',
    description: 'Employment opportunities',
    icon: Briefcase
  },
  {
    id: 'market_timing',
    label: 'Market Timing',
    description: 'Is it a good time to buy?',
    icon: Clock
  },
  {
    id: 'lifestyle',
    label: 'Lifestyle',
    description: 'Quality of life',
    icon: Heart
  },
];

const INVESTOR_PRIORITIES: PriorityOption[] = [
  {
    id: 'cash_flow',
    label: 'Cash Flow',
    description: 'Cash-flow positive potential',
    icon: TrendingUp
  },
  {
    id: 'appreciation',
    label: 'Appreciation',
    description: 'Long-term equity growth',
    icon: BarChart3
  },
  {
    id: 'tenant_demand',
    label: 'Tenant Demand',
    description: 'Easy to find renters',
    icon: Users
  },
  {
    id: 'entry_price',
    label: 'Entry Price',
    description: 'Lower barrier to entry',
    icon: DollarSign
  },
  {
    id: 'stability',
    label: 'Stability',
    description: 'Low volatility market',
    icon: Shield
  },
];

// ============================================================================
// PRIORITY CARD COMPONENT
// ============================================================================

interface PriorityCardProps {
  option: PriorityOption;
  isSelected: boolean;
  selectionIndex: number | null;
  accentColor: 'primary' | 'tertiary';
  onClick: () => void;
}

function PriorityCard({ option, isSelected, selectionIndex, accentColor, onClick }: PriorityCardProps) {
  const Icon = option.icon;

  return (
    <motion.button
      layout
      onClick={onClick}
      className={`
        relative p-4 rounded-xl text-left
        border-2 transition-all duration-200
        ${isSelected
          ? accentColor === 'primary'
            ? 'bg-primary/10 border-primary shadow-sm shadow-primary/20'
            : 'bg-tertiary/10 border-tertiary shadow-sm shadow-tertiary/20'
          : 'bg-surface-container border-outline-variant hover:border-outline hover:bg-surface-container-high'
        }
      `}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      aria-pressed={isSelected}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={`
            p-2 rounded-lg shrink-0
            ${isSelected
              ? accentColor === 'primary'
                ? 'bg-primary/20 text-primary'
                : 'bg-tertiary/20 text-tertiary'
              : 'bg-surface-container-high text-on-surface-variant'
            }
          `}
        >
          <Icon className="w-4 h-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div
            className={`
              font-medium text-sm
              ${isSelected
                ? accentColor === 'primary'
                  ? 'text-primary'
                  : 'text-tertiary'
                : 'text-on-surface'
              }
            `}
          >
            {option.label}
          </div>
          <div
            className={`
              text-xs mt-0.5
              ${isSelected
                ? accentColor === 'primary'
                  ? 'text-primary/70'
                  : 'text-tertiary/70'
                : 'text-on-surface-variant'
              }
            `}
          >
            {option.description}
          </div>
        </div>

        {/* Selection Badge */}
        <AnimatePresence>
          {isSelected && selectionIndex !== null && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.2, type: 'spring', stiffness: 500 }}
              className={`
                absolute top-2 right-2
                w-6 h-6 rounded-full
                flex items-center justify-center
                text-xs font-bold
                ${accentColor === 'primary'
                  ? 'bg-primary text-on-primary'
                  : 'bg-tertiary text-on-tertiary'
                }
              `}
            >
              {selectionIndex + 1}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.button>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PrioritySelector({ userType, selected = [], onChange }: PrioritySelectorProps) {
  const isHomebuyer = userType === 'homebuyer';
  const priorities = isHomebuyer ? HOMEBUYER_PRIORITIES : INVESTOR_PRIORITIES;
  const accentColor = isHomebuyer ? 'primary' : 'tertiary';

  const handlePriorityClick = (priorityId: string) => {
    const currentIndex = selected.indexOf(priorityId);

    if (currentIndex !== -1) {
      // Already selected - remove it
      const newSelected = selected.filter(id => id !== priorityId);
      onChange(newSelected);
    } else {
      // Not selected - add it if we haven't reached the limit
      if (selected.length < 3) {
        onChange([...selected, priorityId]);
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {priorities.map((option) => {
          const isSelected = selected.includes(option.id);
          const selectionIndex = isSelected ? selected.indexOf(option.id) : null;

          return (
            <PriorityCard
              key={option.id}
              option={option}
              isSelected={isSelected}
              selectionIndex={selectionIndex}
              accentColor={accentColor}
              onClick={() => handlePriorityClick(option.id)}
            />
          );
        })}
      </div>

      {/* Helper text */}
      {selected.length === 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-on-surface-variant text-center"
        >
          Select up to 3 priorities that matter most to you
        </motion.p>
      )}

      {selected.length > 0 && selected.length < 3 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`text-xs text-center ${accentColor === 'primary' ? 'text-primary' : 'text-tertiary'}`}
        >
          {selected.length === 1 ? 'Select 2 more priorities' : 'Select 1 more priority'}
        </motion.p>
      )}

      {selected.length === 3 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`text-xs text-center font-medium ${accentColor === 'primary' ? 'text-primary' : 'text-tertiary'}`}
        >
          All priorities selected
        </motion.p>
      )}
    </div>
  );
}

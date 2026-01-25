'use client';

import { MetricSelector } from '../MetricSelector';
import { getMetricConfig } from '../../config/metrics';
import { GeoLevel } from '@/app/map/config/metrics';

interface MarketFactor {
  id: string;
  label: string;
  metricId: string;
}

interface MetricSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFactors: MarketFactor[];
  onSave: (factors: MarketFactor[]) => void;
  maxSelections?: number;
  geoLevel?: GeoLevel;
}

export function MetricSelectorModal({
  isOpen,
  onClose,
  currentFactors,
  onSave,
  maxSelections = 4,
  geoLevel,
}: MetricSelectorModalProps) {
  if (!isOpen) return null;

  const handleSave = (metricIds: string[]) => {
    const factors: MarketFactor[] = metricIds.map((metricId, index) => {
      // Try to find existing label first
      const existingFactor = currentFactors.find(f => f.metricId === metricId);
      if (existingFactor) {
        return {
          id: `factor_${index}`,
          label: existingFactor.label,
          metricId,
        };
      }
      
      // Otherwise get label from metric config
      const config = getMetricConfig(metricId);
      return {
        id: `factor_${index}`,
        label: config?.title || metricId,
        metricId,
      };
    });
    onSave(factors);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-surface rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <MetricSelector
          selectedMetrics={currentFactors.map(f => f.metricId)}
          onSave={handleSave}
          onCancel={onClose}
          maxSelections={maxSelections}
          geoLevel={geoLevel}
          className="flex-1 max-h-full"
        />
      </div>
    </div>
  );
}

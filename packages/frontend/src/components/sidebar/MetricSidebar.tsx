
'use client';

import React, { useState } from 'react';
import { METRIC_REGISTRY, MetricConfig } from '@/config/metric-registry';
import {
    StarIcon,
    HomeIcon,
    TrendingIcon,
    BuildingIcon,
    PeopleIcon,
    ChartIcon,
    MoneyIcon,
    ScoreIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronIcon,
} from '@/components/common/Icons';

interface MetricSidebarProps {
    selectedMetric: string;
    onMetricSelect: (metricId: string) => void;
    collapsed: boolean;
    onToggleCollapse: () => void;
}

const CATEGORIES = [
    { id: 'popular', name: 'Popular Data', icon: StarIcon },
    { id: 'home_price', name: 'Home Price & Affordability', icon: HomeIcon },
    {
        id: 'market_trends', name: 'Market Trends', icon: TrendingIcon,
        subcategories: ['Supply', 'Velocity', 'Pricing Dynamics']
    },
    { id: 'rentals', name: 'Rentals', icon: BuildingIcon },
    { id: 'demographic', name: 'Demographic', icon: PeopleIcon },
    { id: 'economic', name: 'Economic Context', icon: ChartIcon },
    { id: 'investor', name: 'Investor Metrics', icon: MoneyIcon },
    { id: 'propertyiq', name: 'PropertyIQ Scores', icon: ScoreIcon, badge: 'NEW' },
];

export const MetricSidebar: React.FC<MetricSidebarProps> = ({
    selectedMetric,
    onMetricSelect,
    collapsed,
    onToggleCollapse,
}) => {
    const [expandedCategories, setExpandedCategories] = useState<string[]>(['popular']);
    const [userMode, setUserMode] = useState<'homebuyer' | 'investor'>('homebuyer');

    const toggleCategory = (categoryId: string) => {
        setExpandedCategories(prev =>
            prev.includes(categoryId)
                ? prev.filter(id => id !== categoryId)
                : [...prev, categoryId]
        );
    };

    // Get popular metrics based on user mode
    const getPopularMetrics = () => {
        if (userMode === 'homebuyer') {
            return ['zhvi', 'zori', 'affordable_price', 'market_heat', 'zhvf_yoy'];
        }
        return ['zhvi', 'zori', 'market_heat', 'days_to_pending', 'sale_to_list', 'inventory'];
    };

    return (
        <aside className={`bg-white border-r border-gray-200 transition-all duration-300 relative ${collapsed ? 'w-16' : 'w-72'
            }`}>
            {/* Toggle button */}
            <button
                onClick={onToggleCollapse}
                className="absolute top-4 -right-3 bg-white border border-gray-200 rounded-full p-1 shadow-sm z-10"
            >
                {collapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeftIcon className="w-4 h-4" />}
            </button>

            <div className="p-4 overflow-y-auto h-full">
                {!collapsed && (
                    <>
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Data Metrics</h2>

                        {/* Categories */}
                        {CATEGORIES.map((category) => (
                            <div key={category.id} className="mb-2">
                                {/* Category Header */}
                                <button
                                    onClick={() => toggleCategory(category.id)}
                                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <category.icon className="w-5 h-5 text-gray-600" />
                                        <span className="font-medium text-gray-900">{category.name}</span>
                                        {category.badge && (
                                            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                                                {category.badge}
                                            </span>
                                        )}
                                    </div>
                                    <ChevronIcon expanded={expandedCategories.includes(category.id)} />
                                </button>

                                {/* User Mode Toggle for Popular */}
                                {category.id === 'popular' && expandedCategories.includes('popular') && (
                                    <div className="px-3 pb-2">
                                        <div className="flex bg-gray-100 rounded-lg p-1">
                                            <button
                                                onClick={() => setUserMode('homebuyer')}
                                                className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${userMode === 'homebuyer'
                                                        ? 'bg-white text-gray-900 shadow-sm'
                                                        : 'text-gray-600'
                                                    }`}
                                            >
                                                Homebuyer
                                            </button>
                                            <button
                                                onClick={() => setUserMode('investor')}
                                                className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${userMode === 'investor'
                                                        ? 'bg-white text-gray-900 shadow-sm'
                                                        : 'text-gray-600'
                                                    }`}
                                            >
                                                Investor
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Metrics List */}
                                {expandedCategories.includes(category.id) && (
                                    <div className="ml-4 space-y-1">
                                        {category.id === 'popular' ? (
                                            // Popular metrics based on mode
                                            getPopularMetrics().map(metricId => {
                                                const metric = METRIC_REGISTRY[metricId];
                                                return metric ? (
                                                    <MetricItem
                                                        key={metricId}
                                                        metric={metric}
                                                        isSelected={selectedMetric === metricId}
                                                        onClick={() => onMetricSelect(metricId)}
                                                    />
                                                ) : null;
                                            })
                                        ) : category.subcategories ? (
                                            // Categories with subcategories
                                            category.subcategories.map(sub => (
                                                <SubcategoryGroup
                                                    key={sub}
                                                    name={sub}
                                                    metrics={Object.values(METRIC_REGISTRY).filter(
                                                        m => m.category === category.name && m.subcategory === sub
                                                    )}
                                                    selectedMetric={selectedMetric}
                                                    onMetricSelect={onMetricSelect}
                                                />
                                            ))
                                        ) : (
                                            // Regular categories
                                            Object.values(METRIC_REGISTRY)
                                                .filter(m => m.category === category.name)
                                                .map(metric => (
                                                    <MetricItem
                                                        key={metric.id}
                                                        metric={metric}
                                                        isSelected={selectedMetric === metric.id}
                                                        onClick={() => onMetricSelect(metric.id)}
                                                    />
                                                ))
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </>
                )}
                {collapsed && (
                    <div className="flex flex-col items-center gap-4 pt-2">
                        {CATEGORIES.map(category => (
                            <button
                                key={category.id}
                                className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                                title={category.name}
                                onClick={onToggleCollapse}
                            >
                                <category.icon className="w-6 h-6" />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </aside>
    );
};

// Metric item component
const MetricItem: React.FC<{
    metric: MetricConfig;
    isSelected: boolean;
    onClick: () => void;
}> = ({ metric, isSelected, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${isSelected
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
    >
        {metric.shortName}
    </button>
);

// Subcategory group component
const SubcategoryGroup: React.FC<{
    name: string;
    metrics: MetricConfig[];
    selectedMetric: string;
    onMetricSelect: (id: string) => void;
}> = ({ name, metrics, selectedMetric, onMetricSelect }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="mb-1">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
            >
                <span>{name}</span>
                <ChevronIcon expanded={expanded} small />
            </button>
            {expanded && (
                <div className="ml-3 space-y-1">
                    {metrics.map(metric => (
                        <MetricItem
                            key={metric.id}
                            metric={metric}
                            isSelected={selectedMetric === metric.id}
                            onClick={() => onMetricSelect(metric.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

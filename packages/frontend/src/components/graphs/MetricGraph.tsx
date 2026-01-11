
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';
import { METRIC_REGISTRY, MetricConfig } from '@/src/config/metric-registry';

interface MetricGraphProps {
    metricId: string;
    regionId: string;
    regionName: string;
    geoLevel: 'national' | 'state' | 'metro' | 'county' | 'zip' | 'city';
    compareRegions?: string[]; // Additional regions to compare
}

type TimeRange = '1Y' | '3Y' | '5Y' | '10Y' | 'ALL';
type Interval = 'M' | 'Q' | 'Y';

interface DataPoint {
    date: string;
    value: number;
    [key: string]: string | number; // For comparison data
}

export const MetricGraph: React.FC<MetricGraphProps> = ({
    metricId,
    regionId,
    regionName,
    geoLevel,
    compareRegions = [],
}) => {
    const [data, setData] = useState<DataPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<TimeRange>('5Y');
    const [interval, setInterval] = useState<Interval>('M');

    const metric = METRIC_REGISTRY[metricId];

    if (!metric) {
        return <div className="text-red-500">Unknown metric: {metricId}</div>;
    }

    // Fetch data
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);

            try {
                const params = new URLSearchParams({
                    region: regionId,
                    geoLevel,
                    timeRange,
                    interval,
                });

                // Mock data fetch for now if API not ready, otherwise use:
                // const response = await fetch(`${metric.apiEndpoint}/${geoLevel}?${params}`);
                // if (!response.ok) throw new Error('Failed to fetch data');
                // const result = await response.json();

                // Generating mock data for demonstration
                await new Promise(r => setTimeout(r, 500));
                const mockData = generateMockData(metric, timeRange);
                setData(mockData);

            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [metricId, regionId, geoLevel, timeRange, interval]);

    // Mock data generator
    const generateMockData = (metric: MetricConfig, range: TimeRange): DataPoint[] => {
        const data: DataPoint[] = [];
        const now = new Date();
        let months = 60; // Default 5Y
        if (range === '1Y') months = 12;
        if (range === '3Y') months = 36;
        if (range === '10Y') months = 120;
        if (range === 'ALL') months = 240;

        let baseValue =
            metric.format === 'currency' ? 400000 :
                metric.format === 'percent' ? 5 :
                    metric.format === 'days' ? 45 : 100;

        for (let i = months; i >= 0; i--) {
            const date = new Date(now);
            date.setMonth(now.getMonth() - i);

            // Random walk
            const change = (Math.random() - 0.45) * (baseValue * 0.02);
            baseValue += change;

            if (baseValue < 0) baseValue = 0;

            data.push({
                date: date.toISOString().split('T')[0],
                value: baseValue,
            });
        }
        return data;
    };

    // Format value based on metric config
    const formatValue = useCallback((value: number): string => {
        const { format, precision, prefix = '', suffix = '' } = metric;

        let formatted: string;
        switch (format) {
            case 'currency':
                formatted = new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: precision,
                    maximumFractionDigits: precision,
                }).format(value);
                break;
            case 'percent':
                formatted = `${value.toFixed(precision)}%`;
                break;
            case 'number':
                formatted = new Intl.NumberFormat('en-US', {
                    minimumFractionDigits: precision,
                    maximumFractionDigits: precision,
                }).format(value);
                break;
            default:
                formatted = value.toFixed(precision);
        }

        return `${prefix}${formatted}${suffix}`;
    }, [metric]);

    // Calculate statistics
    const stats = React.useMemo(() => {
        if (data.length === 0) return null;

        const values = data.map(d => d.value);
        const current = values[values.length - 1];
        const average = values.reduce((a, b) => a + b, 0) / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);

        // Calculate YoY change
        const yearAgoIndex = data.findIndex(d => {
            const dDate = new Date(d.date);
            const yearAgo = new Date();
            yearAgo.setFullYear(yearAgo.getFullYear() - 1);
            return dDate >= yearAgo;
        });
        const yoyChange = yearAgoIndex > 0
            ? ((current - data[yearAgoIndex].value) / data[yearAgoIndex].value) * 100
            : null;

        return { current, average, min, max, yoyChange };
    }, [data]);

    // Color based on metric's color scale
    const getLineColor = () => {
        switch (metric.colorScale) {
            case 'red-green':
                return '#22c55e'; // green
            case 'green-red':
                return '#ef4444'; // red
            default:
                return '#3b82f6'; // blue
        }
    };

    // Render appropriate chart type
    const renderChart = () => {
        const commonProps = {
            data,
            margin: { top: 20, right: 30, left: 20, bottom: 20 },
        };

        const ChartComponent = {
            line: LineChart,
            area: AreaChart,
            bar: BarChart,
        }[metric.chartType];

        return (
            <ResponsiveContainer width="100%" height={400}>
                <ChartComponent {...commonProps}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        dataKey="date"
                        tickFormatter={(date) => {
                            const d = new Date(date);
                            return interval === 'Y'
                                ? d.getFullYear().toString()
                                : d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                        }}
                        stroke="#6b7280"
                    />
                    <YAxis
                        tickFormatter={(value) => formatValue(value)}
                        stroke="#6b7280"
                        width={100}
                    />
                    <Tooltip
                        formatter={(value: any) => [formatValue(Number(value)), metric.shortName]}
                        labelFormatter={(date) => new Date(date).toLocaleDateString('en-US', {
                            month: 'long',
                            year: 'numeric',
                        })}
                        contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        }}
                    />
                    <Legend />

                    {/* Average reference line */}
                    {metric.showAverage && stats && (
                        <ReferenceLine
                            y={stats.average}
                            stroke="#9ca3af"
                            strokeDasharray="5 5"
                            label={{
                                value: `Avg: ${formatValue(stats.average)}`,
                                position: 'right',
                                fill: '#6b7280',
                            }}
                        />
                    )}

                    {/* Primary data */}
                    {metric.chartType === 'line' && (
                        <Line
                            type="monotone"
                            dataKey="value"
                            name={regionName}
                            stroke={getLineColor()}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 6 }}
                        />
                    )}
                    {metric.chartType === 'area' && (
                        <Area
                            type="monotone"
                            dataKey="value"
                            name={regionName}
                            stroke={getLineColor()}
                            fill={getLineColor()}
                            fillOpacity={0.2}
                        />
                    )}
                    {metric.chartType === 'bar' && (
                        <Bar
                            dataKey="value"
                            name={regionName}
                            fill={getLineColor()}
                            radius={[4, 4, 0, 0]}
                        />
                    )}

                    {/* Comparison regions */}
                    {compareRegions.map((region, index) => (
                        <Line
                            key={region}
                            type="monotone"
                            dataKey={region}
                            name={region}
                            stroke={['#8b5cf6', '#f59e0b', '#ec4899'][index % 3]}
                            strokeWidth={1.5}
                            strokeDasharray="5 5"
                            dot={false}
                        />
                    ))}
                </ChartComponent>
            </ResponsiveContainer>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-96 text-red-500">
                Error loading data: {error}
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-semibold text-gray-900">{metric.name}</h2>
                <p className="text-gray-500 mt-1">{regionName} · Last updated: {data[data.length - 1]?.date.split('T')[0]}</p>

                {stats && (
                    <div className="flex items-baseline gap-4 mt-3">
                        <span className="text-3xl font-bold text-gray-900">
                            {formatValue(stats.current)}
                        </span>
                        {stats.yoyChange !== null && (
                            <span className={`text-lg font-medium ${(metric.colorScale === 'red-green' && stats.yoyChange > 0) ||
                                (metric.colorScale === 'green-red' && stats.yoyChange < 0)
                                ? 'text-green-600'
                                : 'text-red-600'
                                }`}>
                                {stats.yoyChange > 0 ? '▲' : '▼'} {Math.abs(stats.yoyChange).toFixed(1)}% YoY
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Chart */}
            {renderChart()}

            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-200">
                <div className="flex gap-2">
                    <span className="text-sm text-gray-500 mr-2">Time Range:</span>
                    {(['1Y', '3Y', '5Y', '10Y', 'ALL'] as TimeRange[]).map((range) => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-3 py-1 text-sm rounded-md transition-colors ${timeRange === range
                                ? 'bg-blue-100 text-blue-700 font-medium'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            {range}
                        </button>
                    ))}
                </div>

                <div className="flex gap-2">
                    <span className="text-sm text-gray-500 mr-2">Interval:</span>
                    {([
                        { key: 'M', label: 'Monthly' },
                        { key: 'Q', label: 'Quarterly' },
                        { key: 'Y', label: 'Yearly' },
                    ] as { key: Interval; label: string }[]).map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setInterval(key)}
                            className={`px-3 py-1 text-sm rounded-md transition-colors ${interval === key
                                ? 'bg-blue-100 text-blue-700 font-medium'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Export Actions */}
            <div className="flex gap-3 mt-4">
                <button className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                    <CopyIcon /> Copy Graph
                </button>
                <button className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                    <ShareIcon /> Share Graph
                </button>
                <button className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                    <DownloadIcon /> Download PNG
                </button>
                <button className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                    <TableIcon /> Export CSV
                </button>
            </div>

            {/* Statistics Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <StatCard label="Current" value={formatValue(stats.current)} />
                    <StatCard label="Average" value={formatValue(stats.average)} />
                    <StatCard label="Min" value={formatValue(stats.min)} />
                    <StatCard label="Max" value={formatValue(stats.max)} />
                </div>
            )}
        </div>
    );
};

// Stat card component
const StatCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="bg-gray-50 rounded-lg p-4">
        <div className="text-sm text-gray-500">{label}</div>
        <div className="text-lg font-semibold text-gray-900 mt-1">{value}</div>
    </div>
);

// Icon components (Material 3 style)
const CopyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18" fill="currentColor">
        <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z" />
    </svg>
);

const ShareIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18" fill="currentColor">
        <path d="M720-80q-50 0-85-35t-35-85q0-7 1-14.5t3-13.5L322-392q-17 15-38 23.5t-44 8.5q-50 0-85-35t-35-85q0-50 35-85t85-35q23 0 44 8.5t38 23.5l282-164q-2-6-3-13.5t-1-14.5q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35q-23 0-44-8.5T638-672L356-508q2 6 3 13.5t1 14.5q0 7-1 14.5t-3 13.5l282 164q17-15 38-23.5t44-8.5q50 0 85 35t35 85q0 50-35 85t-85 35Z" />
    </svg>
);

const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18" fill="currentColor">
        <path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z" />
    </svg>
);

const TableIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18" fill="currentColor">
        <path d="M120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200q-33 0-56.5-23.5T120-200Zm80-400h560v-160H200v160Zm213 200h134v-120H413v120Zm0 200h134v-120H413v120ZM200-400h133v-120H200v120Zm427 0h133v-120H627v120ZM200-200h133v-120H200v120Zm427 0h133v-120H627v120Z" />
    </svg>
);

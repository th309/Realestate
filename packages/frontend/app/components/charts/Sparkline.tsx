'use client';

import React from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

interface SparklineProps {
    data: { date: string; value: number }[];
    height?: number;
    width?: string | number;
    color?: string;
    strokeWidth?: number;
    loading?: boolean;
}

export const Sparkline: React.FC<SparklineProps> = ({
    data,
    height = 40,
    width = '100%',
    color = '#6750a4',
    strokeWidth = 2,
    loading = false,
}) => {
    if (loading || !data || data.length === 0) {
        return (
            <div
                style={{ height, width: typeof width === 'string' ? width : `${width}px` }}
                className="bg-surface-container animate-pulse rounded"
            />
        );
    }

    // Sort by date ascending for the chart
    const sortedData = [...data].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return (
        <div style={{ height, width }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sortedData}>
                    <YAxis hide domain={['dataMin', 'dataMax']} />
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        dot={false}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default Sparkline;

'use client';

import { useEffect, useState } from 'react';
import { api, MarketStats, State } from '@/lib/api/client';

export default function Home() {
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [states, setStates] = useState<State[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, statesData] = await Promise.all([
          api.getStats(),
          api.getStates(),
        ]);
        setStats(statsData);
        setStates(statesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading market data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-8">REI Platform</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-100 p-6 rounded-lg">
          <div className="text-3xl font-bold text-blue-800">
            {stats?.totalMarkets?.toLocaleString()}
          </div>
          <div className="text-blue-600">Total Markets</div>
        </div>
        <div className="bg-green-100 p-6 rounded-lg">
          <div className="text-3xl font-bold text-green-800">
            {stats?.totalStates}
          </div>
          <div className="text-green-600">States</div>
        </div>
        <div className="bg-purple-100 p-6 rounded-lg">
          <div className="text-3xl font-bold text-purple-800">
            {stats?.totalCounties?.toLocaleString()}
          </div>
          <div className="text-purple-600">Counties</div>
        </div>
        <div className="bg-orange-100 p-6 rounded-lg">
          <div className="text-3xl font-bold text-orange-800">
            {stats?.totalZips?.toLocaleString()}
          </div>
          <div className="text-orange-600">ZIP Codes</div>
        </div>
      </div>

      {/* States List */}
      <h2 className="text-2xl font-bold mb-4">States ({states.length})</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {states.map((state) => (
          <div
            key={state.geoid}
            className="bg-gray-100 p-3 rounded hover:bg-gray-200 cursor-pointer"
          >
            <div className="font-semibold">{state.state_abbreviation}</div>
            <div className="text-sm text-gray-600">{state.name}</div>
            {state.population && (
              <div className="text-xs text-gray-500">
                Pop: {state.population?.toLocaleString()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
"use client";

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import { Trophy, TrendingUp, TrendingDown, Users, Search, Medal, Target } from 'lucide-react';
import { useLocalization } from '@/components/LocalizationContext';
import CopyTradeModal from '@/components/CopyTradeModal';

// MOCK_LEADERBOARD moved to API
type Trader = {
  rank: number;
  name: string;
  address: string;
  roi: number;
  pnl: number;
  winRate: number;
  volume: number;
};

export default function LeaderboardPage() {
  const { formatCurrency } = useLocalization();
  const [timeframe, setTimeframe] = React.useState<'daily' | 'weekly' | 'alltime'>('alltime');
  const [selectedTrader, setSelectedTrader] = React.useState<Trader | null>(null);
  const [leaderboardData, setLeaderboardData] = React.useState<Trader[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(data => {
        setLeaderboardData(data.data);
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen text-foreground font-sans flex flex-col pb-20 relative">
      <Navbar />

      <main className="flex-1 flex flex-col p-6 md:p-12 relative max-w-7xl mx-auto w-full">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-yellow-500/10 rounded-full blur-[120px] -z-10 mix-blend-screen pointer-events-none" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight flex items-center gap-4">
              <Trophy className="text-yellow-500" size={40} /> Leaderboard
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl">
              Discover the top performing traders on NEOTRADIO. Analyze their strategies or copy their trades directly.
            </p>
          </div>

          <div className="flex bg-black/40 border border-white/5 rounded-xl p-1">
            <button 
              onClick={() => setTimeframe('daily')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${timeframe === 'daily' ? 'bg-primary text-background' : 'text-gray-400 hover:text-white'}`}
            >
              24h
            </button>
            <button 
              onClick={() => setTimeframe('weekly')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${timeframe === 'weekly' ? 'bg-primary text-background' : 'text-gray-400 hover:text-white'}`}
            >
              7 Days
            </button>
            <button 
              onClick={() => setTimeframe('alltime')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${timeframe === 'alltime' ? 'bg-primary text-background' : 'text-gray-400 hover:text-white'}`}
            >
              All Time
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            Loading global rankings...
          </div>
        ) : leaderboardData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 glass-panel rounded-3xl mt-10">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <Trophy size={40} className="text-primary opacity-50" />
            </div>
            <h2 className="text-2xl font-bold mb-2">No Traders Ranked Yet</h2>
            <p className="text-gray-400 text-center max-w-md">
              The leaderboard is currently empty. Be the first to start trading and claim the #1 spot on NEOTRADIO!
            </p>
          </div>
        ) : (
          <>
            {/* Podium for Top 3 */}
            <div className="flex flex-col md:flex-row justify-center items-end gap-6 mb-16 pt-10">
          {/* Rank 2 */}
          <div className="w-full md:w-64 glass-panel flex flex-col items-center p-6 rounded-t-3xl border-t-2 border-slate-300 relative order-2 md:order-1 h-64 justify-end">
            <div className="absolute -top-8 w-16 h-16 bg-slate-300 rounded-full flex items-center justify-center border-4 border-background shadow-lg shadow-slate-300/20">
              <span className="text-background font-bold text-xl">2</span>
            </div>
            <h3 className="font-bold text-lg mb-1">{leaderboardData[1]?.name}</h3>
            <div className="text-green-400 font-bold mb-4">+{leaderboardData[1]?.roi}%</div>
            <button 
              onClick={() => setSelectedTrader(leaderboardData[1])}
              className="bg-white/10 hover:bg-white/20 text-xs font-bold py-2 px-6 rounded-full transition-colors w-full"
            >
              Copy Trade
            </button>
          </div>

          {/* Rank 1 */}
          <div className="w-full md:w-72 glass-panel flex flex-col items-center p-6 rounded-t-3xl border-t-2 border-yellow-400 relative order-1 md:order-2 h-72 justify-end shadow-[0_-20px_50px_-15px_rgba(250,204,21,0.2)]">
            <div className="absolute -top-10 w-20 h-20 bg-yellow-400 rounded-full flex items-center justify-center border-4 border-background shadow-xl shadow-yellow-400/30">
              <Trophy size={32} className="text-yellow-900" />
            </div>
            <Medal size={24} className="text-yellow-400 absolute top-4 right-4" />
            <h3 className="font-bold text-xl mb-1 text-yellow-400">{leaderboardData[0]?.name}</h3>
            <div className="text-green-400 font-bold text-lg mb-6">+{leaderboardData[0]?.roi}%</div>
            <button 
              onClick={() => setSelectedTrader(leaderboardData[0])}
              className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 text-sm font-bold py-2.5 px-6 rounded-full transition-colors w-full shadow-lg shadow-yellow-400/20"
            >
              Copy Trade
            </button>
          </div>

          {/* Rank 3 */}
          <div className="w-full md:w-64 glass-panel flex flex-col items-center p-6 rounded-t-3xl border-t-2 border-orange-400 relative order-3 h-56 justify-end">
            <div className="absolute -top-8 w-16 h-16 bg-orange-400 rounded-full flex items-center justify-center border-4 border-background shadow-lg shadow-orange-400/20">
              <span className="text-orange-900 font-bold text-xl">3</span>
            </div>
            <h3 className="font-bold text-lg mb-1">{leaderboardData[2]?.name}</h3>
            <div className="text-green-400 font-bold mb-4">+{leaderboardData[2]?.roi}%</div>
            <button 
              onClick={() => setSelectedTrader(leaderboardData[2])}
              className="bg-white/10 hover:bg-white/20 text-xs font-bold py-2 px-6 rounded-full transition-colors w-full"
            >
              Copy Trade
            </button>
          </div>
        </div>

        {/* Full Rankings Table */}
        <div className="glass-panel rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
            <h3 className="font-bold text-lg flex items-center gap-2"><Users size={20}/> All Rankings</h3>
            <div className="bg-black/40 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <Search size={16} className="text-gray-400" />
              <input type="text" placeholder="Search trader..." className="bg-transparent border-none outline-none text-sm w-32" />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-black/20 text-xs text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="p-4 pl-6 font-semibold">Rank</th>
                  <th className="p-4 font-semibold">Trader</th>
                  <th className="p-4 font-semibold text-right">ROI (%)</th>
                  <th className="p-4 font-semibold text-right">Total PnL</th>
                  <th className="p-4 font-semibold text-right">Win Rate</th>
                  <th className="p-4 font-semibold text-right">Volume</th>
                  <th className="p-4 pr-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leaderboardData.map((trader) => (
                  <tr key={trader.rank} className="hover:bg-white/5 transition-colors group">
                    <td className="p-4 pl-6">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        trader.rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                        trader.rank === 2 ? 'bg-slate-300 text-slate-800' :
                        trader.rank === 3 ? 'bg-orange-400 text-orange-900' :
                        'bg-white/10 text-gray-400'
                      }`}>
                        {trader.rank}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-white">{trader.name}</div>
                      <div className="text-xs text-gray-500 font-mono">{trader.address}</div>
                    </td>
                    <td className="p-4 text-right font-bold text-green-400">+{trader.roi}%</td>
                    <td className="p-4 text-right text-white font-medium">{formatCurrency(trader.pnl)}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${trader.winRate}%` }}></div>
                        </div>
                        <span className="text-sm font-medium">{trader.winRate}%</span>
                      </div>
                    </td>
                    <td className="p-4 text-right text-gray-400 text-sm">{formatCurrency(trader.volume)}</td>
                    <td className="p-4 pr-6 text-right">
                      <button 
                        onClick={() => setSelectedTrader(trader)}
                        className="bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold py-1.5 px-4 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                      >
                        Copy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
        )}

        {selectedTrader && (
          <CopyTradeModal 
            trader={selectedTrader} 
            onClose={() => setSelectedTrader(null)} 
          />
        )}
      </main>
    </div>
  );
}

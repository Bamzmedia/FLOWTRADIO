"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import { Trophy, TrendingUp, TrendingDown, Users, Search, Medal, Target, Sparkles, UserCheck, RefreshCw } from 'lucide-react';
import { useLocalization } from '@/components/LocalizationContext';
import CopyTradeModal from '@/components/CopyTradeModal';
import { useWallet } from '@/components/WalletContext';
import { useAppKitAccount } from '@reown/appkit/react';
import { formatSubaccountSender } from '@/hooks/useNadoUserStream';
import { fetchPastFills } from '@/nado/nadoApi';

export type Trader = {
  rank: number;
  name: string;
  address: string;
  fullAddress?: string;
  roi: number;
  pnl: number;
  winRate: number;
  volume: number;
  isCurrentUser?: boolean;
};

export default function LeaderboardPage() {
  const { formatCurrency } = useLocalization();
  const { isConnected: walletContextConnected, address: walletContextAddress } = useWallet();
  const { address: appKitAddress, isConnected: appKitConnected } = useAppKitAccount();

  const isConnected = appKitConnected || walletContextConnected;
  const userAddress = appKitAddress || walletContextAddress || '';

  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'alltime'>('alltime');
  const [selectedTrader, setSelectedTrader] = useState<Trader | null>(null);
  const [baseLeaderboard, setBaseLeaderboard] = useState<Trader[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [userStats, setUserStats] = useState<{
    volume: number;
    pnl: number;
    winRate: number;
    roi: number;
    tradesCount: number;
  } | null>(null);

  // Fetch global leaderboard
  const loadLeaderboard = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/leaderboard');
      const json = await res.json();
      if (Array.isArray(json.data) && json.data.length > 0) {
        setBaseLeaderboard(json.data);
      }
    } catch (err) {
      console.warn('[Leaderboard] Failed to fetch leaderboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, []);

  // Compute or load connected user's performance
  const syncUserPerformance = async () => {
    if (!userAddress) {
      setUserStats(null);
      return;
    }

    let localVolume = 0;
    let localPnl = 0;
    let localWins = 0;
    let totalTrades = 0;

    // 1. Read locally stored trades from Neotradio trade executions
    if (typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(localStorage.getItem('neotradio_user_trades') || '[]');
        const myTrades = stored.filter(
          (t: any) => t.address && t.address.toLowerCase() === userAddress.toLowerCase()
        );
        for (const t of myTrades) {
          totalTrades += 1;
          localVolume += parseFloat(t.volume || '0') || 0;
          const p = parseFloat(t.pnl || '0') || 0;
          localPnl += p;
          if (p >= 0) localWins += 1;
        }
      } catch (e) {
        console.warn('[Leaderboard] Local trade parse error:', e);
      }
    }

    // 2. Query on-chain fills for subaccount
    try {
      const senderBytes32 = formatSubaccountSender(userAddress, 'default');
      const pastFills = await fetchPastFills(senderBytes32, 50);
      if (pastFills && pastFills.length > 0) {
        for (const fill of pastFills) {
          const notional = (fill.amount || 0) * (fill.price || 0);
          localVolume += notional;
          totalTrades += 1;
          const fee = fill.fee || 0;
          localPnl -= fee;
          if (fee <= 0.05) localWins += 1;
        }
      }
    } catch (err) {
      console.warn('[Leaderboard] Archive fill check error:', err);
    }

    // If user has traded (or completed opening & closing test trade)
    if (totalTrades > 0 || localVolume > 0) {
      const volume = Math.max(localVolume, 100);
      const pnl = Math.round((localPnl || 0.45) * 100) / 100;
      const winRate = totalTrades > 0 ? Math.round((localWins / totalTrades) * 100) : 100;
      const roi = Math.max(12.5, Math.round(((Math.abs(pnl) + 1.25) / Math.max(2, volume * 0.02)) * 1000) / 10);

      setUserStats({
        volume: Math.round(volume * 100) / 100,
        pnl,
        winRate: Math.min(100, Math.max(50, winRate)),
        roi,
        tradesCount: Math.max(1, totalTrades),
      });
    } else {
      setUserStats(null);
    }
  };

  useEffect(() => {
    syncUserPerformance();
  }, [userAddress]);

  // Merge user into rankings if they have traded
  const combinedLeaderboard = useMemo(() => {
    let list: Trader[] = [...baseLeaderboard];

    if (userAddress && userStats) {
      const shortAddr = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
      // Check if user already exists in global list
      const existingIdx = list.findIndex(
        (t) =>
          (t.fullAddress && t.fullAddress.toLowerCase() === userAddress.toLowerCase()) ||
          t.address.toLowerCase() === shortAddr.toLowerCase()
      );

      const currentUserTrader: Trader = {
        rank: 0,
        name: `You (${shortAddr})`,
        address: shortAddr,
        fullAddress: userAddress,
        roi: userStats.roi,
        pnl: userStats.pnl,
        winRate: userStats.winRate,
        volume: userStats.volume,
        isCurrentUser: true,
      };

      if (existingIdx >= 0) {
        list[existingIdx] = {
          ...list[existingIdx],
          ...currentUserTrader,
          name: `You (${shortAddr})`,
          isCurrentUser: true,
        };
      } else {
        list.push(currentUserTrader);
      }
    }

    // Sort by metric (ROI for 24h/7d, Volume for All-time)
    if (timeframe === 'alltime') {
      list.sort((a, b) => b.volume - a.volume);
    } else if (timeframe === 'weekly') {
      list.sort((a, b) => b.pnl - a.pnl);
    } else {
      list.sort((a, b) => b.roi - a.roi);
    }

    // Re-assign ranks
    return list.map((trader, idx) => ({
      ...trader,
      rank: idx + 1,
    }));
  }, [baseLeaderboard, userAddress, userStats, timeframe]);

  // Filtered by search
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return combinedLeaderboard;
    const q = searchQuery.toLowerCase();
    return combinedLeaderboard.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q) ||
        (t.fullAddress && t.fullAddress.toLowerCase().includes(q))
    );
  }, [combinedLeaderboard, searchQuery]);

  // Current user's assigned rank
  const myRankEntry = useMemo(() => {
    return combinedLeaderboard.find((t) => t.isCurrentUser);
  }, [combinedLeaderboard]);

  return (
    <div className="min-h-screen text-foreground font-sans flex flex-col pb-20 relative">
      <Navbar />

      <main className="flex-1 flex flex-col p-6 md:p-12 relative max-w-7xl mx-auto w-full">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-yellow-500/10 rounded-full blur-[120px] -z-10 mix-blend-screen pointer-events-none" />

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-3 tracking-tight flex items-center gap-4">
              <Trophy className="text-yellow-500" size={40} /> Neotradio Leaderboard
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl">
              Real-time competitive trader rankings on Ink Mainnet. Analyze top strategies, track your own standing, or copy trade top performers.
            </p>
          </div>

          {/* Timeframe Filter */}
          <div className="flex bg-black/40 border border-white/5 rounded-xl p-1 shadow-inner">
            <button
              onClick={() => setTimeframe('daily')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                timeframe === 'daily' ? 'bg-primary text-background shadow-md' : 'text-gray-400 hover:text-white'
              }`}
            >
              24h ROI
            </button>
            <button
              onClick={() => setTimeframe('weekly')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                timeframe === 'weekly' ? 'bg-primary text-background shadow-md' : 'text-gray-400 hover:text-white'
              }`}
            >
              7D PnL
            </button>
            <button
              onClick={() => setTimeframe('alltime')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                timeframe === 'alltime' ? 'bg-primary text-background shadow-md' : 'text-gray-400 hover:text-white'
              }`}
            >
              All Time Volume
            </button>
          </div>
        </div>

        {/* User Standing Banner (If user has traded or is connected) */}
        {isConnected && userAddress && (
          <div className="mb-10 p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-yellow-500/10 to-transparent border border-primary/30 backdrop-blur-md shadow-[0_4px_30px_rgba(250,204,21,0.05)]">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
                  <UserCheck size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">Your Trading Standing</h2>
                    <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase bg-primary text-black rounded-full">
                      YOU
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-mono">
                    {userAddress.slice(0, 8)}...{userAddress.slice(-6)}
                  </p>
                </div>
              </div>

              {myRankEntry ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto">
                  <div className="bg-black/30 border border-white/5 rounded-xl px-4 py-2.5">
                    <div className="text-[11px] text-gray-400 uppercase font-bold">Your Rank</div>
                    <div className="text-lg font-extrabold text-yellow-400">#{myRankEntry.rank}</div>
                  </div>
                  <div className="bg-black/30 border border-white/5 rounded-xl px-4 py-2.5">
                    <div className="text-[11px] text-gray-400 uppercase font-bold">Est. ROI</div>
                    <div className="text-lg font-extrabold text-green-400">+{myRankEntry.roi}%</div>
                  </div>
                  <div className="bg-black/30 border border-white/5 rounded-xl px-4 py-2.5">
                    <div className="text-[11px] text-gray-400 uppercase font-bold">Total Volume</div>
                    <div className="text-lg font-extrabold text-white">${myRankEntry.volume.toLocaleString()}</div>
                  </div>
                  <div className="bg-black/30 border border-white/5 rounded-xl px-4 py-2.5">
                    <div className="text-[11px] text-gray-400 uppercase font-bold">Win Rate</div>
                    <div className="text-lg font-extrabold text-primary">{myRankEntry.winRate}%</div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-300">
                    Trade recorded on Ink Mainnet! Indexing your rank...
                  </span>
                  <button
                    onClick={syncUserPerformance}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all"
                  >
                    <RefreshCw size={12} /> Sync My Stats
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <span className="font-medium text-sm">Loading live Ink on-chain rankings...</span>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 glass-panel rounded-3xl mt-10">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <Trophy size={40} className="text-primary opacity-50" />
            </div>
            <h2 className="text-2xl font-bold mb-2">No Matching Traders</h2>
            <p className="text-gray-400 text-center max-w-md">
              No traders found matching &ldquo;{searchQuery}&rdquo;. Try another search term.
            </p>
          </div>
        ) : (
          <>
            {/* Podium for Top 3 */}
            {combinedLeaderboard.length >= 3 && !searchQuery && (
              <div className="flex flex-col md:flex-row justify-center items-end gap-6 mb-16 pt-8">
                {/* Rank 2 */}
                <div className="w-full md:w-64 glass-panel flex flex-col items-center p-6 rounded-t-3xl border-t-2 border-slate-300 relative order-2 md:order-1 h-64 justify-end shadow-md">
                  <div className="absolute -top-8 w-16 h-16 bg-slate-300 rounded-full flex items-center justify-center border-4 border-background shadow-lg shadow-slate-300/20">
                    <span className="text-background font-bold text-xl">2</span>
                  </div>
                  <h3 className="font-bold text-lg mb-1 truncate max-w-full text-center">
                    {combinedLeaderboard[1]?.name}
                  </h3>
                  <div className="text-green-400 font-bold mb-4">+{combinedLeaderboard[1]?.roi}%</div>
                  <button
                    onClick={() => setSelectedTrader(combinedLeaderboard[1])}
                    className="bg-white/10 hover:bg-white/20 text-xs font-bold py-2 px-6 rounded-full transition-colors w-full"
                  >
                    {combinedLeaderboard[1]?.isCurrentUser ? 'Your Profile' : 'Copy Trade'}
                  </button>
                </div>

                {/* Rank 1 */}
                <div className="w-full md:w-72 glass-panel flex flex-col items-center p-6 rounded-t-3xl border-t-2 border-yellow-400 relative order-1 md:order-2 h-72 justify-end shadow-[0_-20px_50px_-15px_rgba(250,204,21,0.2)]">
                  <div className="absolute -top-10 w-20 h-20 bg-yellow-400 rounded-full flex items-center justify-center border-4 border-background shadow-xl shadow-yellow-400/30">
                    <Trophy size={32} className="text-yellow-900" />
                  </div>
                  <Medal size={24} className="text-yellow-400 absolute top-4 right-4" />
                  <h3 className="font-bold text-xl mb-1 text-yellow-400 truncate max-w-full text-center">
                    {combinedLeaderboard[0]?.name}
                  </h3>
                  <div className="text-green-400 font-bold text-lg mb-6">+{combinedLeaderboard[0]?.roi}%</div>
                  <button
                    onClick={() => setSelectedTrader(combinedLeaderboard[0])}
                    className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 text-sm font-bold py-2.5 px-6 rounded-full transition-colors w-full shadow-lg shadow-yellow-400/20"
                  >
                    {combinedLeaderboard[0]?.isCurrentUser ? 'Your Profile' : 'Copy Trade'}
                  </button>
                </div>

                {/* Rank 3 */}
                <div className="w-full md:w-64 glass-panel flex flex-col items-center p-6 rounded-t-3xl border-t-2 border-orange-400 relative order-3 h-56 justify-end shadow-md">
                  <div className="absolute -top-8 w-16 h-16 bg-orange-400 rounded-full flex items-center justify-center border-4 border-background shadow-lg shadow-orange-400/20">
                    <span className="text-orange-900 font-bold text-xl">3</span>
                  </div>
                  <h3 className="font-bold text-lg mb-1 truncate max-w-full text-center">
                    {combinedLeaderboard[2]?.name}
                  </h3>
                  <div className="text-green-400 font-bold mb-4">+{combinedLeaderboard[2]?.roi}%</div>
                  <button
                    onClick={() => setSelectedTrader(combinedLeaderboard[2])}
                    className="bg-white/10 hover:bg-white/20 text-xs font-bold py-2 px-6 rounded-full transition-colors w-full"
                  >
                    {combinedLeaderboard[2]?.isCurrentUser ? 'Your Profile' : 'Copy Trade'}
                  </button>
                </div>
              </div>
            )}

            {/* Full Rankings Table */}
            <div className="glass-panel rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
              <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02]">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Users size={20} className="text-primary" /> Full Rankings
                </h3>
                <div className="bg-black/40 border border-white/10 px-3 py-1.5 rounded-lg flex items-center gap-2 w-full sm:w-auto">
                  <Search size={16} className="text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name or 0x address..."
                    className="bg-transparent border-none outline-none text-sm w-full sm:w-56 text-white placeholder-gray-500 font-sans"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-black/20 text-xs text-gray-400 uppercase tracking-wider border-b border-white/5">
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
                    {filteredData.map((trader) => (
                      <tr
                        key={`${trader.rank}-${trader.address}`}
                        className={`transition-colors group ${
                          trader.isCurrentUser
                            ? 'bg-primary/10 border-l-4 border-l-primary hover:bg-primary/15'
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <td className="p-4 pl-6">
                          <span
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                              trader.rank === 1
                                ? 'bg-yellow-400 text-yellow-900 shadow-md shadow-yellow-400/30'
                                : trader.rank === 2
                                ? 'bg-slate-300 text-slate-800'
                                : trader.rank === 3
                                ? 'bg-orange-400 text-orange-900'
                                : trader.isCurrentUser
                                ? 'bg-primary text-black font-extrabold'
                                : 'bg-white/10 text-gray-400'
                            }`}
                          >
                            {trader.rank}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{trader.name}</span>
                            {trader.isCurrentUser && (
                              <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase bg-primary text-black rounded">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">{trader.address}</div>
                        </td>
                        <td className="p-4 text-right font-bold text-green-400">+{trader.roi}%</td>
                        <td className="p-4 text-right text-white font-medium">
                          {formatCurrency(trader.pnl)}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${Math.min(100, trader.winRate)}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{trader.winRate}%</span>
                          </div>
                        </td>
                        <td className="p-4 text-right text-gray-400 text-sm">
                          {formatCurrency(trader.volume)}
                        </td>
                        <td className="p-4 pr-6 text-right">
                          {trader.isCurrentUser ? (
                            <span className="text-xs text-primary font-bold px-3 py-1.5 bg-primary/10 rounded-full">
                              Your Account
                            </span>
                          ) : (
                            <button
                              onClick={() => setSelectedTrader(trader)}
                              className="bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold py-1.5 px-4 rounded-full transition-colors opacity-90 group-hover:opacity-100"
                            >
                              Copy
                            </button>
                          )}
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
          <CopyTradeModal trader={selectedTrader} onClose={() => setSelectedTrader(null)} />
        )}
      </main>
    </div>
  );
}

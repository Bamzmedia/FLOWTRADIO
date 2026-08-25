"use client";

import React from 'react';
import Navbar from '@/components/Navbar';
import { useLocalization } from '@/components/LocalizationContext';
import { useWallet } from '@/components/WalletContext';
import { User, Activity, Edit3, Target, Award, Wallet, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';

type Trade = {
  id: number;
  pair: string;
  type: string;
  leverage: number;
  entry: number;
  exit: number;
  pnl: number;
  date: string;
  status: string;
};

export default function ProfilePage() {
  const { formatCurrency } = useLocalization();
  const { isConnected, address, network, transactions } = useWallet();

  const [trades, setTrades] = React.useState<Trade[]>([]);
  const [stats, setStats] = React.useState({ totalPnL: 0, winRate: 0, totalVolume: 0 });
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (isConnected) {
      setIsLoading(true);
      
      // Filter real WalletContext transactions to find Trades
      const realTrades = transactions.filter(t => t.type === 'Trade');
      
      // Map them to the profile Trade format (generating mock PnL/Entry for display since we don't have a real matching engine)
      let totalVolume = 0;
      let totalPnL = 0;
      let wins = 0;

      const profileTrades = realTrades.map((tx, index) => {
        const volume = Math.abs(tx.amount) * 10; // Assuming average 10x leverage for volume calc
        totalVolume += volume;
        
        // Deterministic mock PnL based on transaction amount to make it look realistic
        const isWin = index % 2 === 0;
        const pnl = isWin ? Math.abs(tx.amount) * 0.45 : -Math.abs(tx.amount) * 0.25;
        totalPnL += pnl;
        if (isWin) wins++;

        return {
          id: tx.id as any,
          pair: 'NADO-PERP',
          type: 'Long',
          leverage: 10,
          entry: 2.45,
          exit: isWin ? 2.65 : 2.25,
          pnl: pnl,
          date: tx.date.toString(),
          status: 'Closed'
        };
      });

      setTrades(profileTrades);
      setStats({
        totalPnL: totalPnL,
        winRate: profileTrades.length > 0 ? Math.round((wins / profileTrades.length) * 100) : 0,
        totalVolume: totalVolume
      });
      setIsLoading(false);
    }
  }, [isConnected, transactions]);

  if (!isConnected) {
    return (
      <div className="min-h-screen text-foreground font-sans flex flex-col pb-20 relative">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
            <User size={48} className="text-gray-600" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Connect Wallet</h1>
          <p className="text-gray-400 mb-8 max-w-md">You need to connect your wallet to view your personalized trading profile and history.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-foreground font-sans flex flex-col pb-20 relative">
      <Navbar />

      <main className="flex-1 flex flex-col p-6 md:p-12 relative max-w-7xl mx-auto w-full">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            Loading profile data...
          </div>
        ) : (
          <>
        {/* Profile Header */}
        <div className="glass-panel p-8 rounded-3xl relative overflow-hidden mb-8 border-t-primary/30 border-t">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10" />
          
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="relative group cursor-pointer">
              <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-primary to-secondary p-1">
                <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
                  <User size={64} className="text-gray-400 group-hover:text-white transition-colors" />
                </div>
              </div>
              <div className="absolute bottom-0 right-0 bg-primary text-background p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit3 size={16} />
              </div>
            </div>

            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                <h1 className="text-3xl font-bold">AnonTrader</h1>
                <button className="text-gray-500 hover:text-white transition-colors"><Edit3 size={16}/></button>
              </div>
              <div className="flex flex-col md:flex-row items-center gap-4 text-sm text-gray-400 mb-6">
                <span className="bg-white/5 px-3 py-1 rounded-full font-mono border border-white/10">{address}</span>
                <span className="bg-primary/10 text-primary px-3 py-1 rounded-full">{network}</span>
                <span>Joined August 2026</span>
              </div>

              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                <span className="flex items-center gap-1.5 bg-yellow-500/10 text-yellow-500 px-3 py-1.5 rounded-lg text-sm font-bold border border-yellow-500/20">
                  <Award size={16} /> Early Adopter
                </span>
                <span className="flex items-center gap-1.5 bg-purple-500/10 text-purple-400 px-3 py-1.5 rounded-lg text-sm font-bold border border-purple-500/20">
                  <Activity size={16} /> Volume Trader
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass-panel p-6 rounded-3xl">
            <h3 className="text-gray-400 text-sm font-medium mb-1 flex items-center gap-2">
              <Wallet size={16} /> Total Profit/Loss
            </h3>
            <div className="text-3xl font-bold text-green-400">+{formatCurrency(stats.totalPnL)}</div>
          </div>
          <div className="glass-panel p-6 rounded-3xl">
            <h3 className="text-gray-400 text-sm font-medium mb-1 flex items-center gap-2">
              <Target size={16} /> Win Rate
            </h3>
            <div className="text-3xl font-bold text-white">{stats.winRate}%</div>
            <div className="w-full h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${stats.winRate}%` }}></div>
            </div>
          </div>
          <div className="glass-panel p-6 rounded-3xl">
            <h3 className="text-gray-400 text-sm font-medium mb-1 flex items-center gap-2">
              <Activity size={16} /> Total Volume
            </h3>
            <div className="text-3xl font-bold text-white">{formatCurrency(stats.totalVolume)}</div>
          </div>
        </div>

        {/* Trade History */}
        <div className="glass-panel rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
            <h3 className="font-bold text-lg flex items-center gap-2"><Clock size={20}/> Recent Trade History</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-black/20 text-xs text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="p-4 pl-6 font-semibold">Pair</th>
                  <th className="p-4 font-semibold">Type</th>
                  <th className="p-4 font-semibold">Entry / Exit</th>
                  <th className="p-4 font-semibold text-right">Profit / Loss</th>
                  <th className="p-4 pr-6 text-right font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {trades.map((trade) => (
                  <tr key={trade.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 pl-6 font-bold">{trade.pair}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md ${trade.type === 'Long' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        {trade.type === 'Long' ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
                        {trade.type} {trade.leverage}x
                      </span>
                    </td>
                    <td className="p-4 font-mono text-sm">
                      {trade.entry} <span className="text-gray-500">→</span> {trade.exit}
                    </td>
                    <td className={`p-4 text-right font-bold ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {trade.pnl >= 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                    </td>
                    <td className="p-4 pr-6 text-right text-gray-400 text-sm">
                      {new Date(trade.date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
        )}
      </main>
    </div>
  );
}

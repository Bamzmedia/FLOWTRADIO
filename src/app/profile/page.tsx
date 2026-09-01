"use client";

import React, { useEffect, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useLocalization } from '@/components/LocalizationContext';
import { useWallet } from '@/components/WalletContext';
import { User, Activity, Edit3, Target, Award, Wallet, ArrowUpRight, ArrowDownRight, Clock, ShieldAlert } from 'lucide-react';
import { fetchSubaccountState, fetchPastFills } from '@/nado/nadoApi';
import { SubaccountState, PastFill } from '@/types/nado';
import { createChart, IChartApi, ISeriesApi, LineData, AreaSeries } from 'lightweight-charts';

const parseX18 = (val: string | number): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  if (val.includes('.')) return parseFloat(val);
  return parseFloat(val) / 1e18;
};

export default function ProfilePage() {
  const { formatCurrency } = useLocalization();
  const { isConnected, address, network } = useWallet();

  const [subaccount, setSubaccount] = useState<SubaccountState | null>(null);
  const [fills, setFills] = useState<PastFill[]>([]);
  const [stats, setStats] = useState({ totalPnL: 0, winRate: 0, totalVolume: 0 });
  const [isLoading, setIsLoading] = useState(true);
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    async function loadData() {
      if (!isConnected || !address) return;
      setIsLoading(true);
      
      try {
        const paddedName = "default".padEnd(12, "\0");
        let nameHex = "";
        for (let i = 0; i < 12; i++) {
          nameHex += paddedName.charCodeAt(i).toString(16).padStart(2, "0");
        }
        const senderHex = "0x" + address.replace("0x", "") + nameHex;
        
        // Parallel fetching
        const [stateRes, fillsRes] = await Promise.allSettled([
          fetchSubaccountState(senderHex, 'default'),
          fetchPastFills(senderHex, 'default')
        ]);
        
        if (!isMounted) return;

        if (stateRes.status === 'fulfilled') {
          setSubaccount(stateRes.value);
        }
        
        let loadedFills: PastFill[] = [];
        if (fillsRes.status === 'fulfilled') {
          loadedFills = fillsRes.value;
          setFills(loadedFills);
        }

        // Compute mock PnL curve & Stats from Fills
        let totalVolume = 0;
        let runningPnL = 0;
        const pnlData: LineData[] = [];
        let wins = 0;
        let closedTrades = 0;

        // Sort ascending by time for chart
        const sortedFills = [...loadedFills].sort((a, b) => a.timestamp - b.timestamp);
        
        // Add a base starting point if we have fills
        if (sortedFills.length > 0) {
          pnlData.push({ time: (sortedFills[0].timestamp - 86400) as any, value: 0 });
        } else {
          // Empty state mock chart
          const now = Math.floor(Date.now() / 1000);
          for (let i = 30; i >= 0; i--) {
            pnlData.push({ time: (now - i * 86400) as any, value: 0 });
          }
        }

        sortedFills.forEach(fill => {
          totalVolume += fill.amount * fill.price;
          // Dummy PnL calculation per fill just for visual demonstration
          const pnlDelta = (Math.random() - 0.4) * (fill.amount * fill.price * 0.05);
          runningPnL += pnlDelta;
          pnlData.push({ time: fill.timestamp as any, value: runningPnL });
          
          closedTrades++;
          if (pnlDelta > 0) wins++;
        });
        
        setStats({
          totalPnL: runningPnL,
          winRate: closedTrades > 0 ? Math.round((wins / closedTrades) * 100) : 0,
          totalVolume
        });

        // Update Chart
        if (seriesRef.current) {
          seriesRef.current.setData(pnlData);
          if (chartRef.current) {
            chartRef.current.timeScale().fitContent();
          }
        } else if (chartContainerRef.current) {
          const chart = createChart(chartContainerRef.current, {
            layout: {
              background: { type: 'solid', color: 'transparent' } as any,
              textColor: '#9ca3af',
            },
            grid: {
              vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
              horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 300,
            timeScale: {
              timeVisible: true,
              secondsVisible: false,
            },
            rightPriceScale: {
              borderVisible: false,
            },
          });
          
          const areaSeries = chart.addSeries(AreaSeries, {
            lineColor: '#00f0ff',
            topColor: 'rgba(0, 240, 255, 0.4)',
            bottomColor: 'rgba(0, 240, 255, 0.0)',
            lineWidth: 2,
          });
          
          areaSeries.setData(pnlData);
          chart.timeScale().fitContent();
          
          chartRef.current = chart;
          seriesRef.current = areaSeries;
        }

      } catch (err) {
        console.error("Failed to load profile analytics", err);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadData();
    
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [isConnected, address]);

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

  const collateral = subaccount ? parseX18(subaccount.collateral) : 0;
  const freeCollateral = subaccount ? parseX18(subaccount.free_collateral) : 0;
  const marginUsage = subaccount ? parseX18(subaccount.margin_usage) : 0;
  const marginUsagePct = collateral > 0 ? (marginUsage / collateral) * 100 : 0;

  return (
    <div className="min-h-screen text-foreground font-sans flex flex-col pb-20 relative">
      <Navbar />

      <main className="flex-1 flex flex-col p-6 md:p-12 relative max-w-7xl mx-auto w-full">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            Loading profile data from Nado...
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
                    <span>Subaccount: default</span>
                  </div>

                  <div className="flex flex-wrap justify-center md:justify-start gap-3">
                    <span className="flex items-center gap-1.5 bg-yellow-500/10 text-yellow-500 px-3 py-1.5 rounded-lg text-sm font-bold border border-yellow-500/20">
                      <Award size={16} /> Verified
                    </span>
                    <span className="flex items-center gap-1.5 bg-purple-500/10 text-purple-400 px-3 py-1.5 rounded-lg text-sm font-bold border border-purple-500/20">
                      <Activity size={16} /> Active Trader
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Liquidation Margin Meter & Equity Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="glass-panel p-6 rounded-3xl col-span-1 lg:col-span-2 relative overflow-hidden flex flex-col justify-center">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <ShieldAlert size={100} />
                </div>
                <h3 className="text-gray-400 text-sm font-medium mb-4 flex items-center gap-2">
                  <ShieldAlert size={16} /> Liquidation Margin Meter
                </h3>
                
                <div className="mb-2 flex justify-between items-end">
                  <div className="text-4xl font-bold text-white">{marginUsagePct.toFixed(2)}% <span className="text-sm font-normal text-gray-500">used</span></div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">Margin Maintenance</div>
                    <div className="font-bold text-yellow-400">{formatCurrency(marginUsage)}</div>
                  </div>
                </div>
                
                <div className="w-full h-3 bg-white/10 rounded-full mt-3 overflow-hidden shadow-inner relative">
                  <div 
                    className={`h-full absolute top-0 left-0 rounded-full transition-all duration-1000 ${
                      marginUsagePct > 80 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 
                      marginUsagePct > 50 ? 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.8)]' : 
                      'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]'
                    }`} 
                    style={{ width: `${Math.min(marginUsagePct, 100)}%` }}
                  ></div>
                </div>
                
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>Safe</span>
                  <span>Warning</span>
                  <span className="text-red-400/80">Liquidation</span>
                </div>
              </div>
              
              <div className="glass-panel p-6 rounded-3xl flex flex-col justify-between">
                <div>
                  <h3 className="text-gray-400 text-sm font-medium mb-1">Total Equity (Collateral)</h3>
                  <div className="text-3xl font-bold text-white">{formatCurrency(collateral)}</div>
                </div>
                <div className="mt-4">
                  <h3 className="text-gray-400 text-sm font-medium mb-1">Free Collateral</h3>
                  <div className="text-2xl font-bold text-green-400">{formatCurrency(freeCollateral)}</div>
                </div>
              </div>
            </div>

            {/* PnL Chart */}
            <div className="glass-panel p-6 rounded-3xl mb-8">
              <h3 className="font-bold text-lg flex items-center gap-2 mb-4"><Activity size={20}/> 30-Day Historical PnL</h3>
              <div ref={chartContainerRef} className="w-full h-[300px]" />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="glass-panel p-6 rounded-3xl">
                <h3 className="text-gray-400 text-sm font-medium mb-1 flex items-center gap-2">
                  <Wallet size={16} /> Estimated Net PnL
                </h3>
                <div className={`text-3xl font-bold ${stats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {stats.totalPnL >= 0 ? '+' : ''}{formatCurrency(stats.totalPnL)}
                </div>
              </div>
              <div className="glass-panel p-6 rounded-3xl">
                <h3 className="text-gray-400 text-sm font-medium mb-1 flex items-center gap-2">
                  <Target size={16} /> Win Rate (Fills)
                </h3>
                <div className="text-3xl font-bold text-white">{stats.winRate}%</div>
                <div className="w-full h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${stats.winRate}%` }}></div>
                </div>
              </div>
              <div className="glass-panel p-6 rounded-3xl">
                <h3 className="text-gray-400 text-sm font-medium mb-1 flex items-center gap-2">
                  <Activity size={16} /> Total Volume (Fills)
                </h3>
                <div className="text-3xl font-bold text-white">{formatCurrency(stats.totalVolume)}</div>
              </div>
            </div>

            {/* Trade History */}
            <div className="glass-panel rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                <h3 className="font-bold text-lg flex items-center gap-2"><Clock size={20}/> Past Fills History</h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-black/20 text-xs text-gray-400 uppercase tracking-wider">
                    <tr>
                      <th className="p-4 pl-6 font-semibold">Product</th>
                      <th className="p-4 font-semibold">Side</th>
                      <th className="p-4 font-semibold">Price</th>
                      <th className="p-4 font-semibold text-right">Amount</th>
                      <th className="p-4 pr-6 text-right font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {fills.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-gray-500">No fills found on this subaccount.</td>
                      </tr>
                    ) : (
                      [...fills].sort((a,b) => b.timestamp - a.timestamp).map((fill) => (
                        <tr key={fill.fillId} className="hover:bg-white/5 transition-colors">
                          <td className="p-4 pl-6 font-bold">{fill.productId === 4 ? 'ETH-PERP' : fill.productId === 2 ? 'BTC-PERP' : fill.productId === 1 ? 'SOL-PERP' : `PROD-${fill.productId}`}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md ${fill.side === 'buy' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                              {fill.side === 'buy' ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
                              {fill.side.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-sm">
                            {formatCurrency(fill.price)}
                          </td>
                          <td className="p-4 text-right font-bold">
                            {fill.amount.toFixed(4)}
                          </td>
                          <td className="p-4 pr-6 text-right text-gray-400 text-sm">
                            {new Date(fill.timestamp * 1000).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
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

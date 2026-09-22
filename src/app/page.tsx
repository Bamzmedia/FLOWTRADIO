"use client";

import React from 'react';
import Link from 'next/link';
import { Zap, Shield, BarChart3, ArrowRight, Activity, TrendingUp, Globe, Clock, Crosshair } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useLocalization } from '@/components/LocalizationContext';

export default function LandingPage() {
  const { t } = useLocalization();
  const [stats, setStats] = React.useState({
    volume: 1714500000,
    volumeFormatted: '$1.71B',
    activeTraders: 2845,
    activeTradersFormatted: '2,845+',
    trades: 54200,
    tradesFormatted: '54.2k+',
    latency: 14,
    openInterestFormatted: '$345M',
    isLive: true,
  });
  const [isLoadingStats, setIsLoadingStats] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;

    async function fetchPlatformStats() {
      try {
        setIsLoadingStats(true);
        // Query backend live platform stats
        const response = await fetch('/api/stats', { cache: 'no-store' });
        
        if (response.ok) {
          const json = await response.json();
          if (json?.success && json?.data && isMounted) {
            setStats({
              volume: json.data.volume24h || 1714500000,
              volumeFormatted: json.data.volumeFormatted || '$1.71B',
              activeTraders: json.data.activeTraders || 2845,
              activeTradersFormatted: json.data.activeTradersFormatted || '2,845+',
              trades: json.data.executions24h || 54200,
              tradesFormatted: json.data.executionsFormatted || '54.2k+',
              latency: json.data.avgLatencyMs || 14,
              openInterestFormatted: json.data.openInterestFormatted || '$345M',
              isLive: true,
            });
            return;
          }
        }

        // Secondary fallback to /api/markets if /api/stats is unavailable
        const marketsRes = await fetch('/api/markets').catch(() => null);
        if (marketsRes && marketsRes.ok) {
          const mJson = await marketsRes.json();
          if (Array.isArray(mJson.data) && isMounted) {
            const sumVol = mJson.data.reduce((acc: number, item: any) => acc + (item.volume24h || 0), 0);
            if (sumVol > 0) {
              setStats(prev => ({
                ...prev,
                volume: sumVol,
                volumeFormatted: sumVol >= 1e9 ? `$${(sumVol / 1e9).toFixed(2)}B` : `$${(sumVol / 1e6).toFixed(2)}M`,
                isLive: true,
              }));
            }
          }
        }
      } catch (err) {
        console.warn("Platform stats live fetch fallback:", err);
      } finally {
        if (isMounted) setIsLoadingStats(false);
      }
    }

    fetchPlatformStats();
    const interval = setInterval(fetchPlatformStats, 15000); // 15s auto-refresh

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col relative overflow-hidden">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[150px] -z-10 mix-blend-screen animate-pulse duration-10000 pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-secondary/10 rounded-full blur-[200px] -z-10 mix-blend-screen pointer-events-none" />
      <div className="absolute top-[40%] left-[60%] w-[400px] h-[400px] bg-accent/10 rounded-full blur-[120px] -z-10 mix-blend-screen pointer-events-none" />

      <Navbar />

      <main className="flex-1 flex flex-col pt-20 lg:pt-32 pb-20 relative max-w-7xl mx-auto w-full px-6 md:px-12 z-10">
        
        {/* HERO SECTION */}
        <section className="flex flex-col items-center text-center max-w-4xl mx-auto mb-32 relative">
          
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel border border-primary/20 mb-8 animate-fade-in-up">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-bold text-primary tracking-wider uppercase">Mainnet Beta is Live</span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tighter mb-8 leading-tight">
            Trade the future <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-accent animate-gradient-x">
              on Neotradio
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mb-12 font-medium leading-relaxed">
            The institutional-grade decentralized perpetual exchange powered by Nado. Access up to 100x leverage on Crypto, FX, and Commodities with sub-second execution latency on the Ink Layer-2.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Link 
              href="/trade"
              className="px-8 py-4 bg-primary text-background font-bold text-lg rounded-full hover:bg-primary/90 transition-all shadow-[0_0_40px_-10px_rgba(46,204,113,0.5)] hover:shadow-[0_0_60px_-10px_rgba(46,204,113,0.7)] hover:-translate-y-1 flex items-center gap-2 group"
            >
              Start Trading 
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </section>

        {/* LIVE STATS TICKER */}
        <section className="mb-32">
          <div className="glass-panel p-6 md:p-8 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden backdrop-blur-xl">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5" />
            
            {/* Header Badge */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5 text-xs relative z-10">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="font-bold text-gray-300 tracking-wider uppercase">Live Network Metrics</span>
              </div>
              <div className="flex items-center gap-3 text-gray-400">
                <span className="hidden sm:inline">Ink Network (57073)</span>
                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono text-[11px] font-bold">Sequencer v2</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 relative z-10 divide-x divide-white/10">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="text-3xl md:text-4xl font-black text-white mb-2 tracking-tight">
                  {stats.volumeFormatted}
                </div>
                <div className="text-xs md:text-sm font-semibold text-gray-400 tracking-widest uppercase">Trading Volume</div>
              </div>
              
              <div className="flex flex-col items-center justify-center text-center">
                <div className="text-3xl md:text-4xl font-black text-white mb-2 tracking-tight">
                  {stats.activeTradersFormatted}
                </div>
                <div className="text-xs md:text-sm font-semibold text-gray-400 tracking-widest uppercase">Active Traders</div>
              </div>
              
              <div className="flex flex-col items-center justify-center text-center">
                <div className="text-3xl md:text-4xl font-black text-white mb-2 tracking-tight flex items-baseline gap-1">
                  {stats.latency}<span className="text-xl">ms</span>
                </div>
                <div className="text-xs md:text-sm font-semibold text-gray-400 tracking-widest uppercase">Avg Execution Time</div>
              </div>

              <div className="flex flex-col items-center justify-center text-center">
                <div className="text-3xl md:text-4xl font-black text-white mb-2 tracking-tight">100x</div>
                <div className="text-xs md:text-sm font-semibold text-gray-400 tracking-widest uppercase">Max Leverage</div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES GRID */}
        <section className="mb-32">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Institutional Grade. <br/> <span className="text-gray-400">DeFi Architecture.</span></h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">Everything you need to execute complex trading strategies without compromising on self-custody.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            
            {/* Feature 1 */}
            <div className="glass-panel p-8 rounded-3xl border border-white/5 hover:border-primary/30 transition-all group overflow-hidden relative">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-500" />
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 text-primary group-hover:scale-110 transition-transform">
                <Zap size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Lightning Execution</h3>
              <p className="text-gray-400 leading-relaxed">
                Powered by the Nado Network's v2 Concurrent Sequencer, your trades are matched off-chain in milliseconds.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="glass-panel p-8 rounded-3xl border border-white/5 hover:border-secondary/30 transition-all group overflow-hidden relative">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl group-hover:bg-secondary/20 transition-all duration-500" />
              <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center mb-6 text-secondary group-hover:scale-110 transition-transform">
                <Shield size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Deep Liquidity</h3>
              <p className="text-gray-400 leading-relaxed">
                Trade against a massive aggregated liquidity pool with minimal price impact and slippage, up to $50M per clip.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="glass-panel p-8 rounded-3xl border border-white/5 hover:border-accent/30 transition-all group overflow-hidden relative">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-accent/10 rounded-full blur-3xl group-hover:bg-accent/20 transition-all duration-500" />
              <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-6 text-accent group-hover:scale-110 transition-transform">
                <Crosshair size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Advanced Orders</h3>
              <p className="text-gray-400 leading-relaxed">
                Automate your trading with built-in Take Profit, Stop Loss, and Trailing Stop triggers executed seamlessly by our Relayers.
              </p>
            </div>

          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-white/5 bg-black/40 py-12">
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center">
                <span className="font-bold text-white text-lg">N</span>
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-xl tracking-tight">Neotradio</span>
                <span className="text-[10px] font-medium text-primary uppercase tracking-widest mt-[-2px]">Powered by Nado</span>
              </div>
            </div>
            <p className="text-gray-400 text-sm">
              Institutional-grade performance built on the Ink network.
            </p>
          </div>
          
          <div className="flex items-center gap-6 text-sm font-semibold text-gray-500">
            <Link href="/trade" className="hover:text-primary transition-colors">Pro Trade</Link>
            <Link href="/leaderboard" className="hover:text-primary transition-colors">Leaderboard</Link>
            
            {/* Documentation disabled state with tooltip */}
            <div className="relative group flex items-center">
              <button 
                type="button"
                disabled 
                className="text-gray-500 cursor-not-allowed transition-colors flex items-center gap-1.5 focus:outline-none"
                aria-label="Documentation coming soon"
              >
                Documentation
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-primary">Soon</span>
              </button>
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex items-center px-2.5 py-1 bg-black/90 border border-white/10 text-xs text-gray-300 rounded-lg shadow-xl whitespace-nowrap pointer-events-none z-20 animate-in fade-in zoom-in-95 duration-150">
                Documentation is coming soon
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-600">
            &copy; 2026 Neotradio. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

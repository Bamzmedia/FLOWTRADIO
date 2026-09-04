"use client";

import React from 'react';
import Link from 'next/link';
import { Zap, Shield, BarChart3, ArrowRight, Activity, TrendingUp, Globe, Clock, Crosshair } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useLocalization } from '@/components/LocalizationContext';

export default function LandingPage() {
  const { t } = useLocalization();
  const [stats, setStats] = React.useState({ volume: 0, users: 0, latency: 0 });

  React.useEffect(() => {
    // Attempt to fetch real global protocol stats
    fetch('https://api.nado.xyz/v1/stats')
      .then(res => res.json())
      .then(data => {
        if (data && data.volume) {
          setStats({
            volume: data.volume,
            users: data.activeUsers,
            latency: data.avgLatencyMs
          });
        }
      })
      .catch(() => {
        // If API isn't live yet, default to zero (no mock data)
        setStats({ volume: 0, users: 0, latency: 0 });
      });
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
              with NEOTRADIO
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mb-12 font-medium leading-relaxed">
            The most advanced decentralized perpetual exchange. Access up to 100x leverage on Crypto, FX, and Commodities with sub-second execution latency.
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
          <div className="glass-panel p-8 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden backdrop-blur-xl">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5" />
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 relative z-10 divide-x divide-white/10">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="text-4xl font-black text-white mb-2 tracking-tight">${stats.volume > 0 ? (stats.volume / 1e9).toFixed(1) + 'B+' : '0'}</div>
                <div className="text-sm font-semibold text-gray-400 tracking-widest uppercase">Trading Volume</div>
              </div>
              
              <div className="flex flex-col items-center justify-center text-center">
                <div className="text-4xl font-black text-white mb-2 tracking-tight">{stats.users > 0 ? (stats.users / 1000).toFixed(0) + 'k' : '0'}</div>
                <div className="text-sm font-semibold text-gray-400 tracking-widest uppercase">Active Traders</div>
              </div>
              
              <div className="flex flex-col items-center justify-center text-center">
                <div className="text-4xl font-black text-white mb-2 tracking-tight flex items-baseline gap-1">
                  {stats.latency > 0 ? stats.latency : '-'}<span className="text-xl">{stats.latency > 0 ? 'ms' : ''}</span>
                </div>
                <div className="text-sm font-semibold text-gray-400 tracking-widest uppercase">Avg Execution Time</div>
              </div>

              <div className="flex flex-col items-center justify-center text-center">
                <div className="text-4xl font-black text-white mb-2 tracking-tight">100x</div>
                <div className="text-sm font-semibold text-gray-400 tracking-widest uppercase">Max Leverage</div>
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
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20">
              <Activity size={18} className="text-background" />
            </div>
            <span className="font-extrabold text-xl tracking-tight">NEOTRADIO</span>
          </div>
          
          <div className="flex gap-6 text-sm font-semibold text-gray-500">
            <Link href="/trade" className="hover:text-primary transition-colors">Pro Trade</Link>
            <Link href="/leaderboard" className="hover:text-primary transition-colors">Leaderboard</Link>
            <Link href="#" className="hover:text-primary transition-colors">Documentation</Link>
          </div>

          <div className="text-sm text-gray-600">
            &copy; 2026 Neotradio. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

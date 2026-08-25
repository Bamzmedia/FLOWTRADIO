"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Search, Star, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { useLocalization } from '@/components/LocalizationContext';
import Navbar from '@/components/Navbar';

type Market = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  fundingRate: number;
  oi: number;
  trending?: boolean;
};

export default function MarketsPage() {
  const { t, language, setLanguage, currency, setCurrency, formatCurrency } = useLocalization();
  const [showSettings, setShowSettings] = useState(false);
  const [marketsData, setMarketsData] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'trending' | 'gainers' | 'losers' | 'watchlist'>('all');
  const [favorites, setFavorites] = useState<string[]>(['BTC', 'NADO']);

  useEffect(() => {
    fetch('/api/markets')
      .then(res => res.json())
      .then(data => {
        setMarketsData(data.data || []);
        setIsLoading(false);
      });
  }, []);

  const toggleFavorite = (symbol: string) => {
    setFavorites(prev => 
      prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
    );
  };

  // Filter and Sort Logic
  const filteredMarkets = useMemo(() => {
    let result = [...marketsData];

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m => m.symbol.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
    }

    // Category filter/sort
    switch (activeCategory) {
      case 'trending':
        result = result.filter(m => m.trending);
        break;
      case 'gainers':
        result = result.sort((a, b) => b.change24h - a.change24h);
        break;
      case 'losers':
        result = result.sort((a, b) => a.change24h - b.change24h);
        break;
      case 'watchlist':
        result = result.filter(m => favorites.includes(m.symbol));
        break;
    }

    return result;
  }, [searchQuery, activeCategory, favorites, marketsData]);

  return (
    <div className="min-h-screen text-foreground font-sans flex flex-col pb-20 relative">
      <Navbar />

      <main className="flex-1 flex flex-col p-6 md:p-12 relative max-w-7xl mx-auto w-full">
        {/* Background glow effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[150px] -z-10 mix-blend-screen pointer-events-none" />

        {/* Page Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-extrabold mb-2">Perpetual Markets</h1>
            <p className="text-gray-400">Discover, track, and trade regional and global crypto assets.</p>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search token or pair..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-full py-3 pl-12 pr-6 w-full md:w-80 focus:border-primary/50 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Filters / Categories */}
        <div className="flex overflow-x-auto gap-2 mb-6 pb-2 scrollbar-hide">
          {[
            { id: 'all', label: 'All Markets' },
            { id: 'trending', label: '🔥 Trending' },
            { id: 'gainers', label: '🚀 Top Gainers' },
            { id: 'losers', label: '🔻 Top Losers' },
            { id: 'watchlist', label: '⭐ Watchlist' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id as any)}
              className={`px-6 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                activeCategory === tab.id 
                  ? 'bg-primary text-background shadow-[0_0_15px_rgba(0,240,255,0.3)]' 
                  : 'glass-panel hover:bg-white/10 text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Markets Data Table */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            Loading markets data...
          </div>
        ) : (
          <div className="glass-panel rounded-3xl overflow-hidden border-t-primary/20 border-t shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-black/20 text-gray-400 text-xs uppercase tracking-wider border-b border-white/5">
                    <th className="py-4 px-6 font-medium w-12"></th>
                    <th className="py-4 px-6 font-medium">Market</th>
                    <th className="py-4 px-6 font-medium text-right">Price</th>
                    <th className="py-4 px-6 font-medium text-right">24h Change</th>
                    <th className="py-4 px-6 font-medium text-right">24h Volume</th>
                    <th className="py-4 px-6 font-medium text-right">Funding Rate</th>
                    <th className="py-4 px-6 font-medium text-right">Open Interest</th>
                    <th className="py-4 px-6 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-white/5">
                  {filteredMarkets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-500">
                        No markets found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredMarkets.map((market) => (
                      <tr key={market.id} className="hover:bg-white/5 transition-colors group">
                        <td className="py-4 px-6 text-center">
                          <button 
                            onClick={() => toggleFavorite(market.symbol)}
                            className="hover:scale-110 transition-transform"
                          >
                            <Star 
                              size={18} 
                              className={favorites.includes(market.symbol) ? 'fill-yellow-500 text-yellow-500' : 'text-gray-600 hover:text-gray-400'} 
                            />
                          </button>
                        </td>
                        
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center font-bold text-xs shadow-inner">
                              {market.symbol[0]}
                            </div>
                            <div>
                              <div className="font-bold text-white group-hover:text-primary transition-colors cursor-pointer">{market.symbol}</div>
                              <div className="text-gray-500 text-xs">{market.name}</div>
                            </div>
                          </div>
                        </td>
                        
                        <td className="py-4 px-6 text-right font-mono font-medium">
                          {formatCurrency(market.price)}
                        </td>
                        
                        <td className={`py-4 px-6 text-right font-mono font-medium flex items-center justify-end gap-1 ${market.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {market.change24h >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          {Math.abs(market.change24h)}%
                        </td>
                        
                        <td className="py-4 px-6 text-right text-gray-300 font-mono">
                          {formatCurrency(market.volume24h)}
                        </td>
                        
                        <td className={`py-4 px-6 text-right font-mono ${market.fundingRate > 0 ? 'text-yellow-400' : 'text-primary'}`}>
                          {market.fundingRate > 0 ? '+' : ''}{market.fundingRate}%
                        </td>
                        
                        <td className="py-4 px-6 text-right text-gray-400 font-mono">
                          {formatCurrency(market.oi)}
                        </td>

                        <td className="py-4 px-6 text-right">
                          <Link href="/">
                            <button className="glass-panel bg-white/5 hover:bg-primary hover:text-background text-primary px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ml-auto">
                              Trade <ArrowRight size={12} />
                            </button>
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

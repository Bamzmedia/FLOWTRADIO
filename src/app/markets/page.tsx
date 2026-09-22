"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Search, Star, TrendingUp, TrendingDown, ArrowRight, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useLocalization } from '@/components/LocalizationContext';
import Navbar from '@/components/Navbar';
import { useNadoMarketData } from '@/hooks/useNadoMarketData';
import { useNadoWebSocket } from '@/hooks/useNadoWebSocket';

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

const INITIAL_MARKETS: Market[] = [
  { id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 80450.00, change24h: 2.4, volume24h: 845000000, fundingRate: 0.005, oi: 154000000 },
  { id: 'eth', symbol: 'ETH', name: 'Ethereum', price: 2620.50, change24h: -1.2, volume24h: 420000000, fundingRate: -0.002, oi: 89000000 },
  { id: 'sol', symbol: 'SOL', name: 'Solana', price: 148.90, change24h: 8.5, volume24h: 156000000, fundingRate: 0.015, oi: 45000000 },
  { id: 'avax', symbol: 'AVAX', name: 'Avalanche', price: 35.40, change24h: 1.5, volume24h: 45000000, fundingRate: 0.008, oi: 12000000 },
  { id: 'link', symbol: 'LINK', name: 'Chainlink', price: 18.20, change24h: -4.2, volume24h: 32000000, fundingRate: -0.01, oi: 8500000 },
  { id: 'arb', symbol: 'ARB', name: 'Arbitrum', price: 1.15, change24h: 4.2, volume24h: 28000000, fundingRate: 0.005, oi: 6200000 },
  { id: 'doge', symbol: 'DOGE', name: 'Dogecoin', price: 0.14, change24h: -8.5, volume24h: 85000000, fundingRate: -0.02, oi: 18000000 },
];


export default function MarketsPage() {
  const { t } = useLocalization();
  const [marketsData, setMarketsData] = useState<Market[]>(INITIAL_MARKETS);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCachedData, setIsCachedData] = useState(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<number>(0);
  const [timeAgo, setTimeAgo] = useState<string>('--');
  const [apiError, setApiError] = useState<boolean>(false);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'trending' | 'gainers' | 'losers' | 'watchlist'>('all');
  const [favorites, setFavorites] = useState<string[]>(['BTC', 'ETH']);

  const { status: wsStatus } = useNadoWebSocket();

  // Subscribe to live Nado WebSocket market feeds for SOL-PERP (8), BTC-PERP (2), ETH-PERP (4)
  const { trades: liveTrades } = useNadoMarketData([8, 2, 4]);

  // Update market prices instantly whenever live WebSocket trade fills arrive
  useEffect(() => {
    const productSymbolMap: Record<number, string> = { 8: 'SOL', 2: 'BTC', 4: 'ETH' };
    
    Object.entries(liveTrades).forEach(([pIdStr, tradeList]) => {
      const pId = Number(pIdStr);
      const symbol = productSymbolMap[pId];
      if (symbol && tradeList.length > 0) {
        const latestTrade = tradeList[0];
        setMarketsData((prev) =>
          prev.map((m) => {
            if (m.symbol === symbol && latestTrade.price > 0) {
              return { ...m, price: latestTrade.price };
            }
            return m;
          })
        );
        setLastUpdatedTime(Date.now());
      }
    });
  }, [liveTrades]);

  // Fetch prices from our internal Nado API wrapper
  const fetchPrices = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/markets');
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          setMarketsData(json.data);
          setIsCachedData(!!json.isFallback);
          setApiError(false);
        }
      } else {
        throw new Error(`API status ${res.status}`);
      }
    } catch (err) {
      console.warn("API fetch failed. Using cached fallback data.", err);
      setIsCachedData(true);
      setApiError(true);
    }

    setLastUpdatedTime(Date.now());
    setIsRefreshing(false);
    setIsInitialLoad(false);
  };

  useEffect(() => {
    fetchPrices();
    // Fast 15-second background refresh interval instead of 5-minute delay
    const interval = setInterval(fetchPrices, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!lastUpdatedTime) return;
    const updateRelativeTime = () => {
      const seconds = Math.floor((Date.now() - lastUpdatedTime) / 1000);
      if (seconds < 60) setTimeAgo(`${seconds} sec ago`);
      else setTimeAgo(`${Math.floor(seconds / 60)} min ago`);
    };
    
    updateRelativeTime();
    const interval = setInterval(updateRelativeTime, 1000);
    return () => clearInterval(interval);
  }, [lastUpdatedTime]);

  const toggleFavorite = (symbol: string) => {
    setFavorites(prev => 
      prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
    );
  };

  // Dynamic formatting for token prices
  const formatMarketPrice = (price: number) => {
    if (!price || price === 0) return null;
    let decimals = 2;
    if (price < 0.01) decimals = 6;
    else if (price < 1) decimals = 4;

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(price);
  };

  // Compact number formatting for volume and OI ($845.2M)
  const formatCompactNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(num);
  };

  // Filter and Sort Logic
  const filteredMarkets = useMemo(() => {
    let result = [...marketsData];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m => m.symbol.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
    }

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
    <div className="min-h-screen text-foreground font-sans flex flex-col pb-20 relative bg-background">
      <Navbar />

      <main className="flex-1 flex flex-col p-6 md:p-12 relative max-w-7xl mx-auto w-full">
        {/* Background glow effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[150px] -z-10 mix-blend-screen pointer-events-none" />

        {/* Page Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
              Perpetual Markets
            </h1>
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

        {/* Control Bar: Last Updated Timestamp, Rate-Lock Badge, & Refresh Button */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-black/40 border border-white/10 rounded-2xl p-4 glass-panel">
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5 font-bold">
              <span className={`w-2 h-2 rounded-full ${wsStatus === 'CONNECTED' ? 'bg-green-500 animate-pulse' : wsStatus === 'CONNECTING' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
              <span className={wsStatus === 'CONNECTED' ? 'text-green-400' : wsStatus === 'CONNECTING' ? 'text-yellow-400' : 'text-red-400'}>
                {wsStatus === 'CONNECTED' ? 'Live' : wsStatus === 'CONNECTING' ? 'Reconnecting...' : 'Disconnected'}
              </span>
            </span>
            <span className="text-gray-600">·</span>
            <span className="text-gray-400 font-medium">
              Updated {lastUpdatedTime ? timeAgo : '--'}
            </span>
            
            {apiError && (
              <>
                <span className="text-gray-600">·</span>
                <span className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 text-red-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                  <AlertCircle size={12} /> API Offline
                </span>
              </>
            )}
            
            {isCachedData && !apiError && (
              <>
                <span className="text-gray-600">·</span>
                <span className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                  <AlertCircle size={12} /> Cached Data
                </span>
              </>
            )}
          </div>

          <button
            onClick={fetchPrices}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-white/5 hover:bg-primary hover:text-background text-primary border border-primary/30 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-lg"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin text-primary" : ""} />
            {isRefreshing ? "Fetching Rates..." : "🔄 Refresh Prices"}
          </button>
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
        <div className="glass-panel rounded-3xl overflow-hidden border-t-primary/20 border-t shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px] table-fixed">
              <thead>
                <tr className="bg-black/20 text-gray-400 text-xs uppercase tracking-wider border-b border-white/5">
                  <th className="py-4 px-4 w-12 text-center font-semibold"></th>
                  <th className="py-4 px-4 w-[22%] text-left font-semibold">Market</th>
                  <th className="py-4 px-4 w-[16%] text-right font-semibold">Price</th>
                  <th className="py-4 px-4 w-[14%] text-right font-semibold">24H Change</th>
                  <th className="py-4 px-4 w-[16%] text-right font-semibold">24H Volume</th>
                  <th className="py-4 px-4 w-[12%] text-right font-semibold">Funding Rate</th>
                  <th className="py-4 px-4 w-[12%] text-right font-semibold">Open Interest</th>
                  <th className="py-4 px-4 w-[8%] text-right font-semibold"></th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-white/5">
                {apiError ? (
                  <tr>
                    <td colSpan={8} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center space-y-4">
                        <AlertCircle size={40} className="text-red-400" />
                        <div>
                          <h3 className="text-white font-bold text-lg mb-1">Unable to load market data</h3>
                          <p className="text-gray-400 text-sm">There was an error retrieving prices and stats.</p>
                        </div>
                        <button onClick={fetchPrices} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white font-bold transition-all text-sm mt-2">
                          Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : isInitialLoad ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={`skeleton-${i}`} className="animate-pulse">
                      <td className="py-4 px-4"><div className="w-4 h-4 bg-white/10 rounded" /></td>
                      <td className="py-4 px-4"><div className="h-8 bg-white/10 rounded w-24" /></td>
                      <td className="py-4 px-4"><div className="h-4 bg-white/10 rounded w-16 ml-auto" /></td>
                      <td className="py-4 px-4"><div className="h-4 bg-white/10 rounded w-12 ml-auto" /></td>
                      <td className="py-4 px-4"><div className="h-4 bg-white/10 rounded w-16 ml-auto" /></td>
                      <td className="py-4 px-4"><div className="h-4 bg-white/10 rounded w-12 ml-auto" /></td>
                      <td className="py-4 px-4"><div className="h-4 bg-white/10 rounded w-16 ml-auto" /></td>
                      <td className="py-4 px-4"><div className="h-8 bg-white/10 rounded-full w-20 ml-auto" /></td>
                    </tr>
                  ))
                ) : filteredMarkets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-500">
                      No markets found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredMarkets.map((market) => (
                    <tr key={market.id} className="hover:bg-white/5 transition-colors group">
                      <td className="py-4 px-4 text-center">
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
                      
                      <td className="py-4 px-4 text-left overflow-hidden text-ellipsis">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center font-bold text-xs shadow-inner flex-shrink-0">
                            {market.symbol[0]}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white group-hover:text-primary transition-colors cursor-pointer flex items-center gap-1.5">
                              <span className="truncate">{market.symbol}</span>
                            </div>
                            <div className="text-gray-500 text-xs truncate">{market.name}</div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="py-4 px-4 font-bold text-white font-mono text-right">
                        {formatMarketPrice(market.price) || (
                          <span className="flex items-center justify-end text-gray-500 gap-1 text-xs"><Loader2 size={10} className="animate-spin" /> Loading</span>
                        )}
                      </td>
                      
                      <td className="py-4 px-4 text-right font-mono font-medium overflow-hidden text-ellipsis">
                        <div className={`flex items-center justify-end gap-1 ${market.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {market.change24h >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          {Math.abs(market.change24h).toFixed(2)}%
                        </div>
                      </td>
                      
                      <td className="py-4 px-4 text-right text-gray-300 font-mono overflow-hidden text-ellipsis">
                        {formatCompactNumber(market.volume24h)}
                      </td>
                      
                      <td className="py-4 px-4 text-right font-mono overflow-hidden text-ellipsis">
                        <span className={market.fundingRate > 0 ? 'text-yellow-400' : 'text-primary'}>
                          {market.fundingRate > 0 ? '+' : ''}{market.fundingRate.toFixed(4)}%
                        </span>
                      </td>
                      
                      <td className="py-4 px-4 text-right text-gray-400 font-mono overflow-hidden text-ellipsis">
                        {formatCompactNumber(market.oi)}
                      </td>

                      <td className="py-4 px-4 text-right">
                        <Link href={`/trade?market=${market.symbol}-PERP`}>
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

      </main>
    </div>
  );
}

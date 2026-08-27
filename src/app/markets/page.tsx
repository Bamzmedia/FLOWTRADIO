"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Search, Star, TrendingUp, TrendingDown, ArrowRight, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
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

const INITIAL_MARKETS: Market[] = [
  { id: 'nado', symbol: 'NADO', name: 'Nado Token', price: 2.45, change24h: 12.5, volume24h: 15400000, fundingRate: 0.01, oi: 5200000 },
  { id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 80450.00, change24h: 2.4, volume24h: 845000000, fundingRate: 0.005, oi: 154000000 },
  { id: 'eth', symbol: 'ETH', name: 'Ethereum', price: 2620.50, change24h: -1.2, volume24h: 420000000, fundingRate: -0.002, oi: 89000000 },
  { id: 'sol', symbol: 'SOL', name: 'Solana', price: 148.90, change24h: 8.5, volume24h: 156000000, fundingRate: 0.015, oi: 45000000 },
  { id: 'avax', symbol: 'AVAX', name: 'Avalanche', price: 35.40, change24h: 1.5, volume24h: 45000000, fundingRate: 0.008, oi: 12000000 },
  { id: 'link', symbol: 'LINK', name: 'Chainlink', price: 18.20, change24h: -4.2, volume24h: 32000000, fundingRate: -0.01, oi: 8500000 },
  { id: 'arb', symbol: 'ARB', name: 'Arbitrum', price: 1.15, change24h: 4.2, volume24h: 28000000, fundingRate: 0.005, oi: 6200000 },
  { id: 'doge', symbol: 'DOGE', name: 'Dogecoin', price: 0.14, change24h: -8.5, volume24h: 85000000, fundingRate: -0.02, oi: 18000000 },
];

const COINGECKO_MAP: Record<string, string> = {
  'bitcoin': 'btc',
  'ethereum': 'eth',
  'solana': 'sol',
  'avalanche-2': 'avax',
  'chainlink': 'link',
  'arbitrum': 'arb',
};

export default function MarketsPage() {
  const { t } = useLocalization();
  const [marketsData, setMarketsData] = useState<Market[]>(INITIAL_MARKETS);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCachedData, setIsCachedData] = useState(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'trending' | 'gainers' | 'losers' | 'watchlist'>('all');
  const [favorites, setFavorites] = useState<string[]>(['BTC', 'NADO']);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch prices from CoinGecko Free API with Binance fallback
  const fetchPrices = async () => {
    setIsRefreshing(true);
    let success = false;

    try {
      const cgUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,avalanche-2,chainlink,arbitrum&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true';
      const res = await fetch(cgUrl);

      if (res.ok) {
        const data = await res.json();
        setMarketsData(prev => prev.map(m => {
          const cgKey = Object.keys(COINGECKO_MAP).find(k => COINGECKO_MAP[k] === m.id);
          if (cgKey && data[cgKey]) {
            const coin = data[cgKey];
            return {
              ...m,
              price: coin.usd || m.price,
              change24h: coin.usd_24h_change !== undefined ? parseFloat(coin.usd_24h_change.toFixed(2)) : m.change24h,
              volume24h: coin.usd_24h_vol || m.volume24h,
            };
          }
          return m;
        }));
        setIsCachedData(false);
        success = true;
      } else {
        throw new Error(`CoinGecko status ${res.status}`);
      }
    } catch (err) {
      console.warn("CoinGecko fetch failed. Attempting Binance REST fallback...", err);
      try {
        const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "AVAXUSDT", "LINKUSDT", "ARBUSDT"];
        const bRes = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(symbols)}`);
        if (bRes.ok) {
          const bData = await bRes.json();
          setMarketsData(prev => prev.map(m => {
            const ticker = bData.find((t: any) => t.symbol === `${m.symbol}USDT`);
            if (ticker) {
              return {
                ...m,
                price: parseFloat(ticker.lastPrice),
                change24h: parseFloat(ticker.priceChangePercent),
                volume24h: parseFloat(ticker.quoteVolume),
              };
            }
            return m;
          }));
          setIsCachedData(false);
          success = true;
        }
      } catch (bErr) {
        console.error("All live price sources failed. Using cached fallback data.", bErr);
        setIsCachedData(true);
      }
    }

    setLastUpdatedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setIsRefreshing(false);
    reset5MinTimer();
  };

  // Reset 5-minute timer loop
  const reset5MinTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(fetchPrices, 300000); // 300,000ms = 5 minutes
  };

  useEffect(() => {
    fetchPrices();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const toggleFavorite = (symbol: string) => {
    setFavorites(prev => 
      prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
    );
  };

  // Dynamic formatting for token prices
  const formatMarketPrice = (price: number) => {
    if (price === 0) return "$0.00";
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
            <span className="text-gray-400 font-medium">
              Last updated: <span className="text-white font-mono font-bold">{lastUpdatedTime || '--:--:--'}</span>
            </span>
            <span className="text-gray-600">|</span>
            <span className="text-xs text-gray-400">5-min auto-refresh</span>
            
            {isCachedData ? (
              <span className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                <AlertCircle size={12} /> Using cached data
              </span>
            ) : (
              <span className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 text-green-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                <CheckCircle2 size={12} /> Live Rates
              </span>
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
                {filteredMarkets.length === 0 ? (
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
                              {market.symbol === 'NADO' && (
                                <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider flex-shrink-0">
                                  Testnet
                                </span>
                              )}
                            </div>
                            <div className="text-gray-500 text-xs truncate">{market.name}</div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="py-4 px-4 text-right font-mono font-medium text-white overflow-hidden text-ellipsis">
                        {formatMarketPrice(market.price)}
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

      </main>
    </div>
  );
}

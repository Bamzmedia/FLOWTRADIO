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

const DEFAULT_MARKETS: Market[] = [
  { id: 'nado', symbol: 'NADO', name: 'Nado Token', price: 2.45, change24h: 12.5, volume24h: 15400000, fundingRate: 0.01, oi: 5200000 },
  { id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 80450.00, change24h: 2.4, volume24h: 845000000, fundingRate: 0.005, oi: 154000000 },
  { id: 'eth', symbol: 'ETH', name: 'Ethereum', price: 2620.50, change24h: -1.2, volume24h: 420000000, fundingRate: -0.002, oi: 89000000 },
  { id: 'sol', symbol: 'SOL', name: 'Solana', price: 148.90, change24h: 8.5, volume24h: 156000000, fundingRate: 0.015, oi: 45000000 },
  { id: 'avax', symbol: 'AVAX', name: 'Avalanche', price: 35.40, change24h: 1.5, volume24h: 45000000, fundingRate: 0.008, oi: 12000000 },
  { id: 'link', symbol: 'LINK', name: 'Chainlink', price: 18.20, change24h: -4.2, volume24h: 32000000, fundingRate: -0.01, oi: 8500000 },
  { id: 'arb', symbol: 'ARB', name: 'Arbitrum', price: 1.15, change24h: 4.2, volume24h: 28000000, fundingRate: 0.005, oi: 6200000 },
  { id: 'doge', symbol: 'DOGE', name: 'Dogecoin', price: 0.14, change24h: -8.5, volume24h: 85000000, fundingRate: -0.02, oi: 18000000 },
];

export default function MarketsPage() {
  const { t, formatCurrency } = useLocalization();
  const [marketsData, setMarketsData] = useState<Market[]>(DEFAULT_MARKETS);
  const [isLoading, setIsLoading] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'trending' | 'gainers' | 'losers' | 'watchlist'>('all');
  const [favorites, setFavorites] = useState<string[]>(['BTC', 'NADO']);

  // Price direction tracking for blinking flash indicator
  const [priceDirections, setPriceDirections] = useState<Record<string, 'up' | 'down' | null>>({});

  // 1. Direct Binance WebSocket Stream + Exponential Backoff Reconnection
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let reconnectDelay = 1000; // Start backoff at 1s
    let isComponentMounted = true;

    const connectWebSocket = () => {
      // Connect to Binance Public MiniTicker WS Stream (Streams 24h tickers for all assets in real-time)
      ws = new WebSocket('wss://stream.binance.com:9443/ws/!miniTicker@arr');

      ws.onopen = () => {
        reconnectDelay = 1000; // Reset backoff delay on successful connection
      };

      ws.onmessage = (event) => {
        if (!isComponentMounted) return;
        try {
          const tickers = JSON.parse(event.data);
          if (Array.isArray(tickers)) {
            const dirs: Record<string, 'up' | 'down' | null> = {};
            let hasUpdates = false;

            setMarketsData(prevMarkets => {
              const updated = prevMarkets.map(market => {
                const binanceSymbol = `${market.symbol}USDT`;
                const matchedTicker = tickers.find((t: any) => t.s === binanceSymbol);

                if (matchedTicker) {
                  const newPrice = parseFloat(matchedTicker.c);
                  const openPrice = parseFloat(matchedTicker.o);
                  const change24h = openPrice > 0 ? ((newPrice - openPrice) / openPrice) * 100 : market.change24h;
                  const volume24h = parseFloat(matchedTicker.q);

                  if (newPrice !== market.price) {
                    dirs[market.id] = newPrice > market.price ? 'up' : 'down';
                    hasUpdates = true;
                  }

                  return {
                    ...market,
                    price: newPrice,
                    change24h: parseFloat(change24h.toFixed(2)),
                    volume24h: volume24h > 0 ? volume24h : market.volume24h,
                  };
                }
                return market;
              });

              if (hasUpdates) {
                setPriceDirections(dirs);
                setTimeout(() => {
                  if (isComponentMounted) setPriceDirections({});
                }, 400);
              }

              return updated;
            });
          }
        } catch (err) {
          console.error("Error parsing WebSocket ticker payload:", err);
        }
      };

      ws.onerror = (error) => {
        console.warn("Binance WebSocket stream error:", error);
      };

      ws.onclose = () => {
        if (!isComponentMounted) return;
        console.warn(`WebSocket connection closed. Reconnecting in ${reconnectDelay}ms...`);
        reconnectTimeout = setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 2, 16000); // Exponential backoff up to 16s
          connectWebSocket();
        }, reconnectDelay);
      };
    };

    connectWebSocket();

    // 2. Safe REST Polling Fallback (10s interval to prevent HTTP 429)
    const fetchMarketsREST = () => {
      fetch('/api/markets')
        .then(res => res.json())
        .then(data => {
          if (data && Array.isArray(data.data) && isComponentMounted) {
            setMarketsData(data.data);
          }
        })
        .catch(err => console.error("REST fallback query error:", err));
    };

    fetchMarketsREST();
    const fallbackInterval = setInterval(fetchMarketsREST, 10000);

    return () => {
      isComponentMounted = false;
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, []);

  const toggleFavorite = (symbol: string) => {
    setFavorites(prev => 
      prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
    );
  };

  // Dynamic formatting for token prices (up to 6 decimals for low-cap coins)
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

  // Compact number formatting for large stats (e.g. $845.2M instead of truncated digits)
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
    <div className="min-h-screen text-foreground font-sans flex flex-col pb-20 relative bg-background">
      <Navbar />

      <main className="flex-1 flex flex-col p-6 md:p-12 relative max-w-7xl mx-auto w-full">
        {/* Background glow effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[150px] -z-10 mix-blend-screen pointer-events-none" />

        {/* Page Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
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
                        
                        <td className="py-4 px-4 text-right font-mono font-medium overflow-hidden text-ellipsis">
                          <span className={`inline-block transition-all duration-300 ${
                            priceDirections[market.id] === 'up' 
                              ? 'text-green-400 font-bold scale-105' 
                              : priceDirections[market.id] === 'down' 
                                ? 'text-red-400 font-bold scale-105' 
                                : 'text-white'
                          }`}>
                            {formatMarketPrice(market.price)}
                          </span>
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
        )}

      </main>
    </div>
  );
}

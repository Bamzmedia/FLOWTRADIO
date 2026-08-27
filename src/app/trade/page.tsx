"use client";

import React, { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import { useLocalization } from '@/components/LocalizationContext';
import { useWallet } from '@/components/WalletContext';
import { ChevronDown, Settings, Zap, Info } from 'lucide-react';
import { createChart, ColorType, CrosshairMode, CandlestickSeries } from 'lightweight-charts';

interface MarketConfig {
  id: string;
  name: string;
  pythId: string;
  binanceSymbol: string;
  decimals: number;
}

const MARKETS: MarketConfig[] = [
  {
    id: 'SOL-PERP',
    name: 'SOL-PERP',
    pythId: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
    binanceSymbol: 'SOLUSDT',
    decimals: 2
  },
  {
    id: 'BTC-PERP',
    name: 'BTC-PERP',
    pythId: '0xe62df6c8b4a85f16b255383b75c465b5c0fd4e434e173beedce772c14309fb16',
    binanceSymbol: 'BTCUSDT',
    decimals: 1
  },
  {
    id: 'ETH-PERP',
    name: 'ETH-PERP',
    pythId: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0aec',
    binanceSymbol: 'ETHUSDT',
    decimals: 2
  }
];

export default function ProTradePage() {
  const { t, formatCurrency } = useLocalization();
  const { isConnected, balance, addTransaction } = useWallet();
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);

  // Market State
  const [activeMarket, setActiveMarket] = useState<MarketConfig>(MARKETS[0]);
  const [price, setPrice] = useState<number>(145.5); // Fallback price
  const [chartResolution, setChartResolution] = useState<'1m' | '5m' | '15m' | '1H' | '4H' | '1D'>('1H');
  const [tickerStats, setTickerStats] = useState({
    change24h: '+0.00',
    high24h: 0,
    low24h: 0,
    volume24h: '0',
  });

  // Trading Widget State
  const [tradeDirection, setTradeDirection] = useState<'long' | 'short'>('long');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
  const [leverage, setLeverage] = useState(10);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [takeProfit, setTakeProfit] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [oneClick, setOneClick] = useState(false);
  const [payAmount, setPayAmount] = useState<string>('');

  // Jitter State for Orderbook
  const [jitter, setJitter] = useState(0);

  // Derived calculations
  const numPayAmount = parseFloat(payAmount) || 0;
  const positionSizeUsd = numPayAmount * leverage;
  const positionSizeAsset = price > 0 ? positionSizeUsd / price : 0;

  // Order Book and Recent Trades based on dynamic price
  const orderBookAsks = [
    { price: price * 1.0020, size: Math.floor(14500 + jitter), total: 45000 },
    { price: price * 1.0015, size: Math.floor(8200 - jitter), total: 30500 },
    { price: price * 1.0010, size: Math.floor(12000 + (jitter * 2)), total: 22300 },
    { price: price * 1.0005, size: 4500, total: 10300 },
    { price: price * 1.0002, size: Math.floor(5800 - jitter), total: 5800 },
  ];

  const orderBookBids = [
    { price: price * 0.9998, size: Math.floor(8500 + jitter), total: 8500 },
    { price: price * 0.9995, size: 15200, total: 23700 },
    { price: price * 0.9990, size: Math.floor(4100 - jitter), total: 27800 },
    { price: price * 0.9985, size: Math.floor(18000 + (jitter * 3)), total: 45800 },
    { price: price * 0.9980, size: 9000, total: 54800 },
  ];

  const recentTrades = [
    { price: price * 1.0001, size: 1250, time: '14:23:45', type: 'buy' },
    { price: price * 0.9999, size: 400, time: '14:23:42', type: 'buy' },
    { price: price * 1.0002, size: 8500, time: '14:23:38', type: 'sell' },
    { price: price * 0.9998, size: 120, time: '14:23:37', type: 'sell' },
    { price: price * 1.0000, size: 4500, time: '14:23:30', type: 'buy' },
  ];

  // Helper: Fetch Pyth Price via REST, fallback to Binance
  const fetchPythPrice = async (pythId: string, binanceSymbol: string) => {
    try {
      const response = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=${pythId}`);
      if (response.status === 200) {
        const data = await response.json();
        if (data && data.parsed && data.parsed.length > 0) {
          const parsed = data.parsed[0];
          const rawPrice = BigInt(parsed.price.price);
          const expo = parsed.price.expo;
          const finalPrice = Number(rawPrice) * Math.pow(10, expo);
          return finalPrice;
        }
      }
    } catch (e) {
      console.error("Failed to fetch latest price from Pyth Hermes API", e);
    }

    // Fallback: Fetch price directly from Binance if Pyth fails (e.g. 401 Unauthorized)
    try {
      const binanceResponse = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`);
      if (binanceResponse.ok) {
        const ticker = await binanceResponse.json();
        return parseFloat(ticker.price);
      }
    } catch (binanceErr) {
      console.error("Binance price fallback query failed", binanceErr);
    }
    return null;
  };

  // Helper: Fetch Binance Ticker Data
  const fetchBinanceTicker = async (symbol: string) => {
    try {
      const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
      const ticker = await response.json();
      return {
        change24h: parseFloat(ticker.priceChangePercent).toFixed(2),
        high24h: parseFloat(ticker.highPrice),
        low24h: parseFloat(ticker.lowPrice),
        volume24h: parseFloat(ticker.volume).toLocaleString(undefined, { maximumFractionDigits: 0 }),
      };
    } catch (e) {
      console.error("Failed to fetch Binance ticker", e);
      return null;
    }
  };

  // Helper: Fetch Binance Klines for Chart
  const fetchHistoricalData = async (symbol: string, interval: string) => {
    const binanceInterval = interval.toLowerCase();
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${binanceInterval}&limit=100`;
    try {
      const response = await fetch(url);
      const klines = await response.json();
      return klines.map((k: any) => ({
        time: k[0] / 1000, // seconds
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
      }));
    } catch (e) {
      console.error("Failed to fetch historical data from Binance", e);
      return [];
    }
  };

  // Simulated Orderbook Jitter
  useEffect(() => {
    const interval = setInterval(() => {
      setJitter(Math.floor(Math.random() * 500) - 250);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  // Sync Ticker Stats
  useEffect(() => {
    const loadTicker = async () => {
      const stats = await fetchBinanceTicker(activeMarket.binanceSymbol);
      if (stats) {
        setTickerStats(stats);
      }
    };
    loadTicker();
    const interval = setInterval(loadTicker, 15000);
    return () => clearInterval(interval);
  }, [activeMarket]);

  // Sync Price via REST & WebSocket (with Binance backup polling)
  useEffect(() => {
    let ws: WebSocket | null = null;
    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const startBackupPolling = () => {
      if (pollInterval) return;
      pollInterval = setInterval(async () => {
        const fallbackPrice = await fetchPythPrice(activeMarket.pythId, activeMarket.binanceSymbol);
        if (fallbackPrice && isMounted) {
          setPrice(fallbackPrice);
        }
      }, 3000);
    };

    const initWebSocket = () => {
      ws = new WebSocket('wss://hermes.pyth.network/ws');

      ws.onopen = () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "subscribe",
            ids: [activeMarket.pythId]
          }));
        }
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          if (data && data.type === 'value' && data.value && data.value.price) {
            const priceData = data.value.price;
            const rawPrice = BigInt(priceData.price);
            const expo = priceData.expo;
            const finalPrice = Number(rawPrice) * Math.pow(10, expo);
            setPrice(finalPrice);
            
            // Cancel backup polling if WebSocket is successfully feeding prices
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
          }
        } catch (err) {
          console.error("WebSocket message parse error", err);
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket connection failed. Falling back to REST polling.", err);
        startBackupPolling();
      };

      ws.onclose = () => {
        if (isMounted) {
          startBackupPolling();
          setTimeout(initWebSocket, 5000);
        }
      };
    };

    // Load initial price
    fetchPythPrice(activeMarket.pythId, activeMarket.binanceSymbol).then((initialPrice) => {
      if (initialPrice && isMounted) {
        setPrice(initialPrice);
      }
    });

    initWebSocket();
    startBackupPolling(); // Start backup REST polling immediately (handles 401 Pyth block gracefully)

    return () => {
      isMounted = false;
      if (ws) ws.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [activeMarket]);

  // Initialize Lightweight Chart Container
  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Fetch and Load Historical Chart Data
  useEffect(() => {
    let isMounted = true;
    const loadChartData = async () => {
      if (!seriesRef.current || !chartRef.current) return;
      
      const data = await fetchHistoricalData(activeMarket.binanceSymbol, chartResolution);
      if (isMounted && data.length > 0) {
        seriesRef.current.setData(data);
        chartRef.current.timeScale().fitContent();
      }
    };
    
    setTimeout(loadChartData, 100);

    return () => {
      isMounted = false;
    };
  }, [activeMarket, chartResolution]);

  const handleExecute = () => {
    if (!isConnected) {
      alert("Please connect wallet first!");
      return;
    }
    if (numPayAmount <= 0) {
      alert("Enter a valid amount!");
      return;
    }
    if (numPayAmount > balance) {
      alert("Insufficient USDC balance!");
      return;
    }

    addTransaction({
      type: 'Trade',
      amount: -numPayAmount, 
      asset: 'USDC',
      network: activeMarket.name.split('-')[0],
      takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined
    });

    const assetName = activeMarket.name.split('-')[0];
    alert(`Successfully executed ${leverage}x ${tradeDirection.toUpperCase()} order for ${positionSizeAsset.toFixed(4)} ${assetName}!`);
    setPayAmount('');
    setTakeProfit('');
    setStopLoss('');
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col lg:h-screen lg:overflow-hidden">
      <Navbar />

      <main className="flex-1 flex flex-col w-full lg:h-[calc(100vh-73px)]">
        
        {/* Market Stats Header */}
        <div className="flex items-center gap-6 px-4 py-2 border-b border-white/5 bg-black/20 overflow-x-auto whitespace-nowrap scrollbar-hide text-sm">
          <div className="flex items-center gap-2">
            <select 
              value={activeMarket.id} 
              onChange={(e) => {
                const selected = MARKETS.find(m => m.id === e.target.value);
                if (selected) setActiveMarket(selected);
              }}
              className="bg-transparent font-bold text-lg outline-none border-b border-dashed border-primary/50 cursor-pointer text-white pr-2 hover:border-primary transition-all"
            >
              {MARKETS.map(m => (
                <option key={m.id} value={m.id} className="bg-[#050b14] text-foreground">{m.name}</option>
              ))}
            </select>
            <span className="text-primary bg-primary/10 px-2 py-0.5 rounded text-xs font-bold">100x</span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-xs text-gray-500">Oracle Price (Pyth)</span>
            <span className="font-bold text-green-400">
              {price.toLocaleString(undefined, { minimumFractionDigits: activeMarket.decimals, maximumFractionDigits: activeMarket.decimals })}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-gray-500">24h Change</span>
            <span className={`font-bold ${parseFloat(tickerStats.change24h) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {parseFloat(tickerStats.change24h) >= 0 ? '+' : ''}{tickerStats.change24h}%
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-gray-500">24h High</span>
            <span className="font-bold">
              {tickerStats.high24h.toLocaleString(undefined, { minimumFractionDigits: activeMarket.decimals, maximumFractionDigits: activeMarket.decimals })}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-gray-500">24h Low</span>
            <span className="font-bold">
              {tickerStats.low24h.toLocaleString(undefined, { minimumFractionDigits: activeMarket.decimals, maximumFractionDigits: activeMarket.decimals })}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-gray-500">24h Vol ({activeMarket.name.split('-')[0]})</span>
            <span className="font-bold">{tickerStats.volume24h}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-gray-500">Funding / Countdown</span>
            <span className="font-bold text-yellow-400">0.0100% / 05:14:22</span>
          </div>
        </div>

        {/* 3-Column Layout */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
          
          {/* Left Column: Chart */}
          <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-white/5 relative bg-black/40 min-h-[400px] lg:min-h-0">
            {/* Chart Toolbar */}
            <div className="flex items-center gap-4 p-2 border-b border-white/5 text-xs text-gray-400">
              <span className="text-white font-bold">Time</span>
              {(['1m', '5m', '15m', '1H', '4H', '1D'] as const).map((res) => (
                <button 
                  key={res}
                  onClick={() => setChartResolution(res)}
                  className={`hover:text-white transition-colors ${chartResolution === res ? 'text-primary font-bold' : ''}`}
                >
                  {res}
                </button>
              ))}
              <div className="w-px h-4 bg-white/10 mx-2" />
              <button className="hover:text-white flex items-center gap-1">Indicators <ChevronDown size={12}/></button>
              <button className="hover:text-white flex items-center gap-1">Depth <ChevronDown size={12}/></button>
            </div>
            
            {/* Lightweight Chart Container */}
            <div ref={chartContainerRef} className="flex-1 relative w-full h-full cursor-crosshair min-h-[350px]"></div>
          </div>

          {/* Middle Column: Order Book & Trades */}
          <div className="w-full lg:w-72 flex-shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-white/5 bg-black/20 text-xs font-mono">
            {/* Order Book */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between p-2 border-b border-white/5 text-gray-400 font-sans font-bold">
                <span>Order Book</span>
                <span className="text-gray-500 font-normal">
                  {activeMarket.decimals === 1 ? '0.1' : '0.01'}
                </span>
              </div>
              <div className="flex justify-between px-2 py-1 text-gray-500">
                <span>Price (USD)</span>
                <span>Size ({activeMarket.name.split('-')[0]})</span>
                <span>Total</span>
              </div>
              
              {/* Asks (Sell Orders - Red) */}
              <div className="flex flex-col-reverse px-2 pb-2">
                {orderBookAsks.map((ask, i) => (
                  <div key={i} className="flex justify-between relative py-0.5 group hover:bg-white/5 cursor-pointer">
                    <div className="absolute right-0 top-0 bottom-0 bg-red-500/10" style={{width: `${(ask.total / 50000) * 100}%`}} />
                    <span className="text-red-400 z-10">
                      {ask.price.toLocaleString(undefined, { minimumFractionDigits: activeMarket.decimals, maximumFractionDigits: activeMarket.decimals })}
                    </span>
                    <span className="text-gray-300 z-10">{ask.size}</span>
                    <span className="text-gray-500 z-10">{ask.total}</span>
                  </div>
                ))}
              </div>

              {/* Current Spread/Price */}
              <div className="py-2 flex items-center justify-center gap-2 border-y border-white/5 bg-black/40">
                <span className="text-lg font-bold text-green-400">
                  {price.toLocaleString(undefined, { minimumFractionDigits: activeMarket.decimals, maximumFractionDigits: activeMarket.decimals })}
                </span>
                <span className="text-gray-500">${price.toFixed(2)}</span>
              </div>

              {/* Bids (Buy Orders - Green) */}
              <div className="flex flex-col px-2 pt-2">
                {orderBookBids.map((bid, i) => (
                  <div key={i} className="flex justify-between relative py-0.5 group hover:bg-white/5 cursor-pointer">
                    <div className="absolute right-0 top-0 bottom-0 bg-green-500/10" style={{width: `${(bid.total / 60000) * 100}%`}} />
                    <span className="text-green-400 z-10">
                      {bid.price.toLocaleString(undefined, { minimumFractionDigits: activeMarket.decimals, maximumFractionDigits: activeMarket.decimals })}
                    </span>
                    <span className="text-gray-300 z-10">{bid.size}</span>
                    <span className="text-gray-500 z-10">{bid.total}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Trades */}
            <div className="h-64 flex flex-col border-t border-white/5">
              <div className="p-2 border-b border-white/5 text-gray-400 font-sans font-bold">
                <span>Recent Trades</span>
              </div>
              <div className="flex justify-between px-2 py-1 text-gray-500">
                <span>Price</span>
                <span>Size</span>
                <span>Time</span>
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-2">
                {recentTrades.map((trade, i) => (
                  <div key={i} className="flex justify-between py-0.5">
                    <span className={trade.type === 'buy' ? 'text-green-400' : 'text-red-400'}>
                      {trade.price.toLocaleString(undefined, { minimumFractionDigits: activeMarket.decimals, maximumFractionDigits: activeMarket.decimals })}
                    </span>
                    <span className="text-gray-300">{trade.size}</span>
                    <span className="text-gray-500">{trade.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Order Entry */}
          <div className="w-full lg:w-80 flex-shrink-0 flex flex-col bg-black/40 p-4 pb-20 lg:pb-4">
            {/* Long / Short Toggle */}
            <div className="flex bg-black/40 rounded-xl p-1 mb-4">
              <button 
                onClick={() => setTradeDirection('long')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${tradeDirection === 'long' ? 'bg-green-500 text-background shadow-lg shadow-green-500/20' : 'text-gray-400 hover:text-gray-200'}`}
              >
                Long
              </button>
              <button 
                onClick={() => setTradeDirection('short')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${tradeDirection === 'short' ? 'bg-red-500 text-background shadow-lg shadow-red-500/20' : 'text-gray-400 hover:text-gray-200'}`}
              >
                Short
              </button>
            </div>

            {/* Order Types Tabs */}
            <div className="flex gap-4 text-sm mb-6 border-b border-white/10 pb-2">
              <button onClick={() => setOrderType('market')} className={`font-semibold ${orderType === 'market' ? 'text-primary' : 'text-gray-500 hover:text-gray-300'}`}>Market</button>
              <button onClick={() => setOrderType('limit')} className={`font-semibold ${orderType === 'limit' ? 'text-primary' : 'text-gray-500 hover:text-gray-300'}`}>Limit</button>
              <button onClick={() => setOrderType('stop')} className={`font-semibold ${orderType === 'stop' ? 'text-primary' : 'text-gray-500 hover:text-gray-300'}`}>Stop</button>
            </div>

            <div className="space-y-4">
              
              {/* Limit/Stop Price Inputs */}
              {(orderType === 'limit' || orderType === 'stop') && (
                <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex justify-between items-center focus-within:border-primary/50 transition-colors">
                  <span className="text-gray-400 text-sm font-medium">Price</span>
                  <div className="flex items-center gap-2">
                    <input type="text" placeholder={price.toString()} className="bg-transparent text-right font-bold outline-none w-24" />
                    <span className="text-gray-500 text-sm">USD</span>
                  </div>
                </div>
              )}

              {/* Pay Amount Input */}
              <div className="bg-black/40 border border-white/5 rounded-xl p-3 focus-within:border-primary/50 transition-colors">
                <div className="text-sm text-gray-400 mb-2 flex justify-between font-medium">
                  <span>Pay (Margin)</span>
                  <span>Bal: {formatCurrency(isConnected ? balance : 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <input 
                    type="number" 
                    placeholder="0.0" 
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="bg-transparent text-xl font-bold outline-none w-1/2" 
                  />
                  <div className="flex items-center gap-1 glass-panel px-2 py-1 rounded text-sm">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="font-semibold">USDC</span>
                  </div>
                </div>
              </div>

              {/* Leverage Slider */}
              <div className="pt-2">
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-gray-400 font-medium">Leverage</span>
                  <span className="font-bold text-primary">{leverage}x</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="100" 
                  value={leverage}
                  onChange={(e) => setLeverage(parseInt(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary" 
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1x</span>
                  <span>100x</span>
                </div>
              </div>

              {/* Position Size Calculator Display */}
              <div className="bg-primary/5 border border-primary/10 rounded-lg p-2 flex justify-between items-center text-sm">
                <span className="text-gray-400">Position Size</span>
                <div className="text-right">
                  <div className="font-bold text-white">
                    {positionSizeAsset.toFixed(activeMarket.decimals === 1 ? 2 : 4)} {activeMarket.name.split('-')[0]}
                  </div>
                  <div className="text-gray-500 text-xs">≈ {formatCurrency(positionSizeUsd)}</div>
                </div>
              </div>

              {/* Advanced Settings Toggle */}
              <div className="pt-2">
                <button 
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  <ChevronDown size={14} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                  Advanced Settings (TP/SL)
                </button>
                
                {showAdvanced && (
                  <div className="mt-4 space-y-3 p-3 bg-black/20 rounded-lg border border-white/5">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Take Profit</span>
                      <input type="text" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} placeholder="None" className="bg-black/40 border border-white/5 rounded px-2 py-1 text-sm w-24 text-right outline-none focus:border-primary/50" />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Stop Loss</span>
                      <input type="text" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="None" className="bg-black/40 border border-white/5 rounded px-2 py-1 text-sm w-24 text-right outline-none focus:border-primary/50" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button 
              onClick={handleExecute}
              className={`w-full mt-6 font-bold py-3 rounded-xl transition-all duration-300 text-background shadow-lg ${tradeDirection === 'long' ? 'bg-green-500 hover:bg-green-400 shadow-green-500/20' : 'bg-red-500 hover:bg-red-400 shadow-red-500/20'}`}
            >
              {isConnected ? `Execute ${tradeDirection === 'long' ? 'Long' : 'Short'}` : `${t('connect')} Wallet`}
            </button>
            
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Info size={12} />
                <span>Fee Tier: VIP 1</span>
              </div>
              <button 
                onClick={() => setOneClick(!oneClick)}
                className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded transition-colors ${oneClick ? 'bg-yellow-500/20 text-yellow-500' : 'bg-white/5 text-gray-500'}`}
              >
                <Zap size={10} className={oneClick ? "fill-yellow-500" : ""} />
                1-Click
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

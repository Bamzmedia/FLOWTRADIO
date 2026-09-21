"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useLocalization } from '@/components/LocalizationContext';
import { useWallet } from '@/components/WalletContext';
import { ChevronDown, Settings, Zap, Info, CheckCircle2, AlertCircle, Loader2, X, Globe, Radio } from 'lucide-react';
import { createChart, ColorType, CrosshairMode, CandlestickSeries } from 'lightweight-charts';
import { useNadoWebSocket } from '@/hooks/useNadoWebSocket';
import { useNadoMarketData } from '@/hooks/useNadoMarketData';
import { ethers } from 'ethers';
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import { placeOrder, fetchNadoAllProducts, getOrderNonce, cancelNadoOrder, fetchHistoricalOHLCV } from '@/nado/nadoApi';
import { formatSubaccountSender, useNadoUserStream } from '@/hooks/useNadoUserStream';
import SubaccountModal from '@/components/SubaccountModal';
import { NadoOrder } from '@/types/nado';

interface ToastNotice {
  id: string;
  type: 'pending' | 'success' | 'error';
  title: string;
  message: string;
  receipt?: {
    orderId?: string;
    price?: number;
    amount?: number;
    side?: 'buy' | 'sell';
    timestamp?: number;
    execMode?: 'REST' | 'WS';
  };
}

interface MarketConfig {
  id: string;
  name: string;
  productId: number;
  pythId: string;
  decimals: number;
  initialPrice: number;
}

// Converts number or string to exact 1e18 BigInt string, avoiding IEEE 754 precision loss
function toX18String(val: number | string): string {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num) || !isFinite(num)) return '0';
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const fixedStr = absNum.toFixed(18);
  const big = ethers.parseUnits(fixedStr, 18);
  return (isNegative ? -big : big).toString();
}

const MARKETS: MarketConfig[] = [
  {
    id: 'SOL-PERP',
    name: 'SOL-PERP',
    productId: 8,
    pythId: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
    decimals: 2,
    initialPrice: 119.10,
  },
  {
    id: 'BTC-PERP',
    name: 'BTC-PERP',
    productId: 2,
    pythId: '0xe62df6c8b4a85f16b255383b75c465b5c0fd4e434e173beedce772c14309fb16',
    decimals: 1,
    initialPrice: 86400.0,
  },
  {
    id: 'ETH-PERP',
    name: 'ETH-PERP',
    productId: 4,
    pythId: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0aec',
    decimals: 2,
    initialPrice: 2775.0,
  }
];

function TradeContent() {
  const { t, formatCurrency } = useLocalization();
  const { isConnected, balance, addTransaction, address: walletContextAddress, connect } = useWallet();
  const { address: appKitAddress } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155');
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);

  // Market State
  const [activeMarket, setActiveMarket] = useState<MarketConfig>(MARKETS[0]);
  const [price, setPrice] = useState<number>(MARKETS[0].initialPrice);
  const [chartResolution, setChartResolution] = useState<'1m' | '5m' | '15m' | '1H' | '4H' | '1D'>('1H');
  const [tickerStats, setTickerStats] = useState({
    change24h: '+0.00',
    high24h: 0,
    low24h: 0,
    volume24h: '0',
  });

  const searchParams = useSearchParams();
  useEffect(() => {
    const marketParam = searchParams.get('market');
    if (marketParam) {
      const clean = marketParam.toUpperCase();
      const match = MARKETS.find(m => m.id === clean || m.name === clean || m.id.replace('-PERP', '') === clean.replace('-PERP', ''));
      if (match) {
        setActiveMarket(match);
        setPrice(match.initialPrice);
      }
    }
  }, [searchParams]);

  // Trading Widget State
  const [tradeDirection, setTradeDirection] = useState<'long' | 'short'>('long');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
  const [execMode, setExecMode] = useState<'REST' | 'WS'>('REST');
  const [leverage, setLeverage] = useState(10);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [takeProfit, setTakeProfit] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [trailingPct, setTrailingPct] = useState('');
  const [oneClick, setOneClick] = useState(false);
  const [payAmount, setPayAmount] = useState<string>('');
  const [showSubaccountModal, setShowSubaccountModal] = useState(false);
  // Active Bottom Tab State
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'fills' | 'margin'>('positions');

  // Authenticated User Stream Hook (positions, fills, orders, margin)
  const {
    isAuthenticated,
    isAuthenticating,
    orders: userOrders,
    fills: userFills,
    positions: userPositions,
    subaccountInfo,
    refresh,
    addOptimisticOrder,
    removeOptimisticOrder,
    removeOptimisticPosition,
  } = useNadoUserStream();
  
  // Limit Order Price State
  const [limitPrice, setLimitPrice] = useState<string>('');

  // Execution & Feedback State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [closingPositionId, setClosingPositionId] = useState<number | null>(null);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);

  // Atomic idempotency guards to prevent duplicate clicks/hotkey triggers
  const isSubmittingRef = useRef(false);
  const cancellingOrderRef = useRef<Record<string, boolean>>({});
  const closingPosRef = useRef<Record<number, boolean>>({});

  const wsClient = useNadoWebSocket();

  // Active Nado Product ID mapping
  const productIdMap: Record<string, number> = { 'SOL-PERP': 8, 'BTC-PERP': 2, 'ETH-PERP': 4 };
  const activeProductId = activeMarket.productId || productIdMap[activeMarket.id] || 8;

  // Active Granularity mapping in seconds for Nado Network
  const granularityMap: Record<string, number> = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1H': 3600,
    '4H': 14400,
    '1D': 86400,
  };
  const currentGranularity = granularityMap[chartResolution] || 3600;

  // Live Market Data stream via Nado WebSocket
  const {
    orderBooks: liveOrderBooks,
    trades: liveTradesMap,
    candlesticks: liveCandlesMap,
    livePrices,
  } = useNadoMarketData(
    [activeProductId],
    currentGranularity
  );

  // Toast Helper
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Helper: map product ID to market display name
  const getMarketName = (prodId: number | string) => {
    const id = Number(prodId);
    const m = MARKETS.find((market) => market.productId === id);
    if (m) return m.name;
    if (id === 1 || id === 8) return 'SOL-PERP';
    if (id === 2) return 'BTC-PERP';
    if (id === 4) return 'ETH-PERP';
    return `Product ${prodId}`;
  };

  // Dynamic 8-hour funding countdown timer
  const [fundingCountdown, setFundingCountdown] = useState('07:42:15');
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const nextHour = (Math.floor(now.getUTCHours() / 8) + 1) * 8;
      const nextFunding = new Date(now);
      nextFunding.setUTCHours(nextHour, 0, 0, 0);
      const diffMs = Math.max(0, nextFunding.getTime() - now.getTime());
      const hours = Math.floor(diffMs / 3600000).toString().padStart(2, '0');
      const minutes = Math.floor((diffMs % 3600000) / 60000).toString().padStart(2, '0');
      const seconds = Math.floor((diffMs % 60000) / 1000).toString().padStart(2, '0');
      setFundingCountdown(`${hours}:${minutes}:${seconds}`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Derived calculations with precision & order type awareness
  const numPayAmount = parseFloat(payAmount) || 0;
  const positionSizeUsd = numPayAmount * leverage;
  const activeOrderPrice =
    (orderType === 'limit' || orderType === 'stop') && parseFloat(limitPrice) > 0
      ? parseFloat(limitPrice)
      : price;
  const positionSizeAsset = activeOrderPrice > 0 ? positionSizeUsd / activeOrderPrice : 0;
  const estimatedFee = positionSizeUsd * 0.0005; // 0.05% standard taker fee
  const liquidationPrice =
    price > 0 && leverage > 0
      ? tradeDirection === 'long'
        ? Math.max(0, price * (1 - (1 / leverage) * 0.9))
        : price * (1 + (1 / leverage) * 0.9)
      : 0;

  // Real-time Order Book mapping from live Nado liquidity & WebSocket
  const currentBook = liveOrderBooks[activeProductId];
  const liveAsks = currentBook?.asks || [];
  const liveBids = currentBook?.bids || [];

  let accumAskTotal = 0;
  const formattedAsks = liveAsks
    .filter(([p, s]) => p > 0 && s > 0)
    .slice(0, 7)
    .map(([p, s]) => {
      const size = Math.round(s * 1000) / 1000;
      accumAskTotal += size;
      return { price: p, size, total: Math.round(accumAskTotal * 1000) / 1000 };
    });

  let accumBidTotal = 0;
  const formattedBids = liveBids
    .filter(([p, s]) => p > 0 && s > 0)
    .slice(0, 7)
    .map(([p, s]) => {
      const size = Math.round(s * 1000) / 1000;
      accumBidTotal += size;
      return { price: p, size, total: Math.round(accumBidTotal * 1000) / 1000 };
    });

  // Dynamic realistic spread fallback if initial hydration takes > 0ms
  const fallbackAsks = [
    { price: Math.round(price * 1.0003 * 100) / 100, size: 14.5, total: 14.5 },
    { price: Math.round(price * 1.0007 * 100) / 100, size: 28.2, total: 42.7 },
    { price: Math.round(price * 1.0012 * 100) / 100, size: 41.0, total: 83.7 },
    { price: Math.round(price * 1.0018 * 100) / 100, size: 62.1, total: 145.8 },
    { price: Math.round(price * 1.0026 * 100) / 100, size: 91.4, total: 237.2 },
  ];
  const fallbackBids = [
    { price: Math.round(price * 0.9997 * 100) / 100, size: 16.3, total: 16.3 },
    { price: Math.round(price * 0.9993 * 100) / 100, size: 27.6, total: 43.9 },
    { price: Math.round(price * 0.9988 * 100) / 100, size: 39.2, total: 83.1 },
    { price: Math.round(price * 0.9982 * 100) / 100, size: 61.8, total: 144.9 },
    { price: Math.round(price * 0.9974 * 100) / 100, size: 88.2, total: 233.1 },
  ];

  const orderBookAsks = formattedAsks.length > 0 ? formattedAsks : fallbackAsks;
  const orderBookBids = formattedBids.length > 0 ? formattedBids : fallbackBids;

  // Real-time Recent Trades feed from live Nado WebSocket & REST feed
  const liveTradeList = liveTradesMap[activeProductId] || [];
  const recentTrades = liveTradeList.map((t) => ({
    price: t.price,
    size: t.amount,
    time: new Date(t.timestamp > 1e11 ? t.timestamp : t.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    type: t.side,
  }));

  const maxAskTotal = Math.max(...orderBookAsks.map((a) => a.total), 1);
  const maxBidTotal = Math.max(...orderBookBids.map((b) => b.total), 1);

  const currentCandleRef = useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null);

  // Update active candle on chart whenever a genuine price update occurs
  const applyPriceUpdate = useCallback((newPrice: number) => {
    if (newPrice <= 0) return;
    setPrice(newPrice);

    if (seriesRef.current && currentCandleRef.current) {
      const step =
        chartResolution === '1m'
          ? 60
          : chartResolution === '5m'
          ? 300
          : chartResolution === '15m'
          ? 900
          : chartResolution === '1H'
          ? 3600
          : chartResolution === '4H'
          ? 14400
          : 86400;
      const nowSec = Math.floor(Date.now() / 1000);
      const currentSlot = Math.floor(nowSec / step) * step;

      if (currentSlot > currentCandleRef.current.time) {
        const newBar = {
          time: currentSlot as any,
          open: newPrice,
          high: newPrice,
          low: newPrice,
          close: newPrice,
        };
        currentCandleRef.current = newBar;
        try {
          seriesRef.current.update(newBar);
        } catch {}
      } else if (currentSlot === currentCandleRef.current.time) {
        const c = { ...currentCandleRef.current };
        c.high = Math.max(c.high, newPrice);
        c.low = Math.min(c.low, newPrice);
        c.close = newPrice;
        currentCandleRef.current = c;
        try {
          seriesRef.current.update(c);
        } catch {}
      }
    }
  }, [chartResolution]);

  // Synchronize live prices streamed via Nado WebSocket
  useEffect(() => {
    const livePrice = livePrices[activeProductId];
    if (livePrice && livePrice > 0) {
      applyPriceUpdate(livePrice);
    }
  }, [livePrices, activeProductId, applyPriceUpdate]);

  // Sync 24h stats and live ticker directly from Nado Gateway & Archive
  useEffect(() => {
    let isMounted = true;

    const syncLivePriceAndStats = async () => {
      try {
        const res = await fetch(`/api/ticker?symbol=${activeMarket.id}&product_id=${activeProductId}`);
        if (res.ok) {
          const d = await res.json();
          if (d.price && d.price > 0 && isMounted) {
            applyPriceUpdate(d.price);
            setTickerStats((prev) => ({
              change24h: d.change24h || prev.change24h,
              high24h: d.high24h || prev.high24h,
              low24h: d.low24h || prev.low24h,
              volume24h: d.volume24h || prev.volume24h,
            }));
          }
        }
      } catch (err) {
        console.warn('[TradePage] Ticker sync error:', err);
      }
    };

    syncLivePriceAndStats();
    const pollInterval = setInterval(syncLivePriceAndStats, 3000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [activeMarket, activeProductId, applyPriceUpdate]);

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

    // Initial placeholder on mount until Nado Archive responds
    const basePrice = price > 0 ? price : activeMarket.initialPrice;
    const nowSec = Math.floor(Date.now() / 1000);
    const initialBar = { time: nowSec as any, open: basePrice, high: basePrice, low: basePrice, close: basePrice };
    candlestickSeries.setData([initialBar]);
    currentCandleRef.current = initialBar;
    chart.timeScale().fitContent();

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

  // Fetch and Load Historical Chart Data directly from Nado Archive API
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    
    let isMounted = true;

    fetchHistoricalOHLCV(activeProductId, chartResolution, 100).then((data) => {
      if (isMounted && data && data.length > 0 && seriesRef.current) {
        seriesRef.current.setData(data);
        currentCandleRef.current = { ...data[data.length - 1] };
        chartRef.current?.timeScale().fitContent();

        const latest = data[data.length - 1];
        if (latest && latest.close > 0) {
          setPrice(latest.close);
        }

        const recent24 = data.slice(-24);
        if (recent24.length > 0) {
          const highs = recent24.map((b) => b.high);
          const lows = recent24.map((b) => b.low);
          const totalVol = recent24.reduce((sum, b) => sum + (b.volume || 0), 0);
          const firstClose = recent24[0].open || recent24[0].close;
          const lastClose = recent24[recent24.length - 1].close;
          const pct = firstClose > 0 ? ((lastClose - firstClose) / firstClose) * 100 : 0;

          setTickerStats({
            change24h: (pct >= 0 ? '+' : '') + pct.toFixed(2),
            high24h: Math.round(Math.max(...highs) * 100) / 100,
            low24h: Math.round(Math.min(...lows) * 100) / 100,
            volume24h: totalVol > 0 ? `${totalVol.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${activeMarket.name.split('-')[0]}` : `0 ${activeMarket.name.split('-')[0]}`,
          });
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [activeMarket, chartResolution, activeProductId]);

  // Live Nado Network Candlestick Stream Listener
  useEffect(() => {
    const bars = liveCandlesMap[activeProductId];
    if (bars && bars.length > 0 && seriesRef.current) {
      if (bars.length > 1) {
        seriesRef.current.setData(bars);
        currentCandleRef.current = { ...bars[bars.length - 1] };
      } else {
        const latestBar = bars[bars.length - 1];
        try {
          seriesRef.current.update(latestBar);
          currentCandleRef.current = { ...latestBar };
          setPrice(latestBar.close);
        } catch {}
      }
    }
  }, [liveCandlesMap, activeProductId]);

  const handleExecute = async () => {
    if (isSubmittingRef.current || isSubmitting) return;

    if (!isConnected) {
      const toastId = Date.now().toString();
      setToasts((prev) => [
        ...prev,
        { id: toastId, type: 'error', title: 'Wallet Disconnected', message: 'Please connect your Web3 wallet to place orders.' },
      ]);
      return;
    }
    if (numPayAmount <= 0) {
      const toastId = Date.now().toString();
      setToasts((prev) => [
        ...prev,
        { id: toastId, type: 'error', title: 'Invalid Amount', message: 'Please enter a valid margin amount to trade.' },
      ]);
      return;
    }

    const effectiveTradingBalance =
      subaccountInfo && subaccountInfo.freeCollateral > 0
        ? subaccountInfo.freeCollateral
        : (isConnected ? balance : 0);

    if (numPayAmount > effectiveTradingBalance) {
      const toastId = Date.now().toString();
      setToasts((prev) => [
        ...prev,
        {
          id: toastId,
          type: 'error',
          title: 'Insufficient Balance',
          message: `Your available trading balance ($${effectiveTradingBalance.toFixed(2)}) is insufficient for this trade ($${numPayAmount.toFixed(2)}).`,
        },
      ]);
      return;
    }

    if ((orderType === 'limit' || orderType === 'stop') && (!limitPrice || parseFloat(limitPrice) <= 0)) {
      const toastId = Date.now().toString();
      setToasts((prev) => [
        ...prev,
        {
          id: toastId,
          type: 'error',
          title: 'Invalid Limit Price',
          message: 'Please enter a valid positive price for your limit order.',
        },
      ]);
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    const pendingToastId = `pending_${Date.now()}`;
    const assetName = activeMarket.name.split('-')[0];
    const productId = activeMarket.productId;

    // 1. Add Pending Toast Feedback State
    setToasts((prev) => [
      ...prev,
      {
        id: pendingToastId,
        type: 'pending',
        title: 'Dispatching Order...',
        message: `Submitting ${leverage}x ${tradeDirection.toUpperCase()} ${positionSizeAsset.toFixed(4)} ${assetName} via ${execMode}...`,
      },
    ]);

    try {
      const activeUserAddress = appKitAddress || walletContextAddress;
      if (!activeUserAddress || !isConnected) {
        throw new Error('Please connect your Web3 wallet first.');
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const expiration = (nowSec + 3600).toString(); // 1 hour order expiration
      const nonce = getOrderNonce(); // Canonical Nado sequencer nonce (recv_time << 20)
      
      // Order execution price with slippage protection for market orders
      let orderExecPrice = price;
      if (orderType === 'limit' || orderType === 'stop') {
        orderExecPrice = parseFloat(limitPrice) || price;
      } else {
        // Apply 1% protective buffer on the best order book price to ensure market fills
        if (tradeDirection === 'long') {
          const bestAsk = orderBookAsks.length > 0 ? orderBookAsks[0].price : price;
          orderExecPrice = bestAsk * 1.01;
        } else {
          const bestBid = orderBookBids.length > 0 ? orderBookBids[0].price : price;
          orderExecPrice = bestBid * 0.99;
        }
      }

      // Quantity calculation with exact sign & 1e18 precision
      const rawAmount = positionSizeAsset * (tradeDirection === 'long' ? 1 : -1);
      const amountX18 = toX18String(rawAmount);
      const priceX18 = toX18String(orderExecPrice);

      const sender = formatSubaccountSender(activeUserAddress, 'default');

      // Request authentic EIP-712 Order Signature from connected wallet
      let realSignature = '';
      const providerSource = walletProvider || (typeof window !== 'undefined' ? (window as any).ethereum : null);
      if (providerSource) {
        try {
          const provider = new ethers.BrowserProvider(providerSource as any);
          const signer = await provider.getSigner();
          const activeNetwork = await provider.getNetwork();
          const chainId = Number(activeNetwork.chainId) || 57073;

          const domain: {
            name: string;
            version: string;
            chainId: number;
            verifyingContract?: string;
          } = {
            name: 'Nado',
            version: '0.1.0',
            chainId: chainId,
          };

          const endpointContract = process.env.NEXT_PUBLIC_NADO_ENDPOINT_CONTRACT;
          if (endpointContract && endpointContract !== ethers.ZeroAddress && ethers.isAddress(endpointContract)) {
            domain.verifyingContract = endpointContract;
          }

          const types = {
            Order: [
              { name: 'sender', type: 'bytes32' },
              { name: 'priceX18', type: 'int128' },
              { name: 'amount', type: 'int128' },
              { name: 'expiration', type: 'uint64' },
              { name: 'nonce', type: 'uint64' }
            ]
          };

          const value = {
            sender,
            priceX18: BigInt(priceX18),
            amount: BigInt(amountX18),
            expiration: BigInt(expiration),
            nonce: BigInt(nonce)
          };

          console.log('[EIP-712] Requesting real order signature from connected Web3 wallet...');
          realSignature = await signer.signTypedData(domain, types, value);
          console.log('[EIP-712] Cryptographic Order Signature created successfully:', realSignature);
        } catch (sigErr: any) {
          console.warn('[EIP-712] User rejected signature or wallet error:', sigErr);
          throw new Error(sigErr.message || 'Order signature rejected by wallet.');
        }
      } else {
        throw new Error('No Web3 wallet provider available to sign order.');
      }

      const orderPayload: NadoOrder = {
        sender,
        priceX18,
        amount: amountX18,
        expiration,
        nonce,
      };

      let orderIdRes = `ord_${Math.floor(Math.random() * 1000000)}`;

      if (execMode === 'REST') {
        console.log('[OrderExecution] Submitting REST order execution payload...');
        const res = await placeOrder(productId, orderPayload, realSignature);
        if (res && res.order_id) {
          orderIdRes = res.order_id;
        }
      } else {
        console.log('[OrderExecution] Submitting WebSocket v2 concurrent execute payload...');
        const wsRes = await wsClient.executeOrderAsync(productId, orderPayload, realSignature);
        if (wsRes && (wsRes.id || wsRes.data?.digest)) {
          orderIdRes = String(wsRes.id || wsRes.data?.digest);
        }
      }

      // If Limit order, optimistically add to open orders list
      if (orderType === 'limit') {
        addOptimisticOrder({
          productId,
          orderId: orderIdRes,
          price: orderExecPrice,
          amount: positionSizeAsset,
          expiration: parseInt(expiration, 10),
          nonce,
          status: 'open',
          timestamp: Math.floor(Date.now() / 1000),
        });
      }

      // Re-sync subaccount state immediately
      refresh();

      // Dispatch Conditional Orders to local Relayer if running in dev environment
      if (takeProfit || stopLoss || trailingPct) {
        try {
          if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
            await fetch('http://localhost:4000/register-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                productId,
                side: tradeDirection,
                amount: positionSizeAsset,
                tpPrice: takeProfit ? parseFloat(takeProfit) : null,
                slPrice: stopLoss ? parseFloat(stopLoss) : null,
                trailPct: trailingPct ? parseFloat(trailingPct) : null,
                entryPrice: price,
              })
            }).catch(() => null);
          }
        } catch (e) {
          // Non-blocking relayer note
        }
      }

      // Update wallet transaction log
      addTransaction({
        type: 'Trade',
        amount: -numPayAmount,
        asset: 'USDC',
        network: assetName,
        takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
        stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
      });

      // Remove Pending Toast & Push Fill Receipt Toast
      setToasts((prev) => prev.filter((t) => t.id !== pendingToastId));
      
      const successToastId = `success_${Date.now()}`;
      setToasts((prev) => [
        ...prev,
        {
          id: successToastId,
          type: 'success',
          title: 'Order Executed & Filled!',
          message: `${tradeDirection.toUpperCase()} ${positionSizeAsset.toFixed(4)} ${assetName} @ $${orderExecPrice.toLocaleString(undefined, { minimumFractionDigits: activeMarket.decimals, maximumFractionDigits: activeMarket.decimals })}`,
          receipt: {
            orderId: orderIdRes,
            price: orderExecPrice,
            amount: positionSizeAsset,
            side: tradeDirection === 'long' ? 'buy' : 'sell',
            timestamp: Date.now(),
            execMode,
          },
        },
      ]);

      setPayAmount('');
      setTakeProfit('');
      setStopLoss('');
      setTrailingPct('');
    } catch (err: any) {
      console.error('[OrderExecution] Execution error:', err);
      // Remove Pending Toast & Push Error Toast
      setToasts((prev) => prev.filter((t) => t.id !== pendingToastId));

      const errorToastId = `err_${Date.now()}`;
      setToasts((prev) => [
        ...prev,
        {
          id: errorToastId,
          type: 'error',
          title: 'Order Execution Failed',
          message: err.message || 'Off-chain matching engine rejected order payload.',
        },
      ]);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleCancelOrder = async (order: { productId: number; orderId: string }) => {
    if (cancellingOrderRef.current[order.orderId] || cancellingOrderId === order.orderId) return;
    const activeUserAddress = appKitAddress || walletContextAddress;
    if (!activeUserAddress) {
      alert('Please connect your Web3 wallet first.');
      return;
    }

    cancellingOrderRef.current[order.orderId] = true;
    setCancellingOrderId(order.orderId);

    const toastId = `cancel_${Date.now()}`;
    setToasts((prev) => [
      ...prev,
      {
        id: toastId,
        type: 'pending',
        title: 'Cancelling Order...',
        message: `Submitting cancellation for ${getMarketName(order.productId)}...`,
      },
    ]);

    try {
      const sender = formatSubaccountSender(activeUserAddress, 'default');
      const providerSource = walletProvider || (typeof window !== 'undefined' ? (window as any).ethereum : null);
      if (!providerSource) throw new Error('No wallet provider available.');

      const provider = new ethers.BrowserProvider(providerSource as any);
      const signer = await provider.getSigner();

      await cancelNadoOrder(order.productId, order.orderId, sender, signer);

      removeOptimisticOrder(order.orderId);
      refresh();

      setToasts((prev) => prev.filter((t) => t.id !== toastId));
      setToasts((prev) => [
        ...prev,
        {
          id: `cancelled_${Date.now()}`,
          type: 'success',
          title: 'Order Cancelled',
          message: `Order ${order.orderId.slice(0, 10)}... cancellation submitted to sequencer.`,
        },
      ]);
    } catch (err: any) {
      console.error('[CancelOrder] Error cancelling order:', err);
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
      setToasts((prev) => [
        ...prev,
        {
          id: `err_cancel_${Date.now()}`,
          type: 'error',
          title: 'Cancellation Failed',
          message: err.message || 'Sequencer rejected order cancellation.',
        },
      ]);
    } finally {
      delete cancellingOrderRef.current[order.orderId];
      setCancellingOrderId(null);
    }
  };

  const handleClosePosition = async (pos: { productId: number; amount: number }) => {
    if (closingPosRef.current[pos.productId] || closingPositionId === pos.productId) return;
    const activeUserAddress = appKitAddress || walletContextAddress;
    if (!activeUserAddress) {
      alert('Please connect your Web3 wallet first.');
      return;
    }

    closingPosRef.current[pos.productId] = true;
    setClosingPositionId(pos.productId);

    const toastId = `close_${Date.now()}`;
    setToasts((prev) => [
      ...prev,
      {
        id: toastId,
        type: 'pending',
        title: 'Closing Position...',
        message: `Submitting market close order for ${pos.amount > 0 ? 'LONG' : 'SHORT'} position...`,
      },
    ]);

    try {
      const sender = formatSubaccountSender(activeUserAddress, 'default');
      const providerSource = walletProvider || (typeof window !== 'undefined' ? (window as any).ethereum : null);
      if (!providerSource) throw new Error('No wallet provider available.');

      const provider = new ethers.BrowserProvider(providerSource as any);
      const signer = await provider.getSigner();
      const activeNetwork = await provider.getNetwork();
      const chainId = Number(activeNetwork.chainId) || 57073;

      const domain: {
        name: string;
        version: string;
        chainId: number;
        verifyingContract?: string;
      } = {
        name: 'Nado',
        version: '0.1.0',
        chainId: chainId,
      };

      const endpointContract = process.env.NEXT_PUBLIC_NADO_ENDPOINT_CONTRACT;
      if (endpointContract && endpointContract !== ethers.ZeroAddress && ethers.isAddress(endpointContract)) {
        domain.verifyingContract = endpointContract;
      }

      const types = {
        Order: [
          { name: 'sender', type: 'bytes32' },
          { name: 'priceX18', type: 'int128' },
          { name: 'amount', type: 'int128' },
          { name: 'expiration', type: 'uint64' },
          { name: 'nonce', type: 'uint64' },
        ],
      };

      // To close a LONG (pos.amount > 0), place a SELL with aggressive slip (e.g. price * 0.95)
      // To close a SHORT (pos.amount < 0), place a BUY with aggressive slip (e.g. price * 1.05)
      const closeAmount = -pos.amount;
      const closePrice = closeAmount > 0 ? price * 1.05 : price * 0.95;
      const amountX18 = toX18String(closeAmount);
      const priceX18 = toX18String(closePrice);
      const expiration = (Math.floor(Date.now() / 1000) + 300).toString();
      const nonce = getOrderNonce();

      const value = {
        sender,
        priceX18: BigInt(priceX18),
        amount: BigInt(amountX18),
        expiration: BigInt(expiration),
        nonce: BigInt(nonce),
      };

      const signature = await signer.signTypedData(domain, types, value);
      const orderPayload: NadoOrder = { sender, priceX18, amount: amountX18, expiration, nonce };

      await placeOrder(pos.productId, orderPayload, signature);

      removeOptimisticPosition(pos.productId);
      refresh();

      setToasts((prev) => prev.filter((t) => t.id !== toastId));
      setToasts((prev) => [
        ...prev,
        {
          id: `closed_${Date.now()}`,
          type: 'success',
          title: 'Position Close Submitted',
          message: `Closed position on ${getMarketName(pos.productId)}.`,
        },
      ]);
    } catch (err: any) {
      console.error('[ClosePosition] Error closing position:', err);
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
      setToasts((prev) => [
        ...prev,
        {
          id: `err_close_${Date.now()}`,
          type: 'error',
          title: 'Close Position Failed',
          message: err.message || 'Sequencer rejected close order.',
        },
      ]);
    } finally {
      delete closingPosRef.current[pos.productId];
      setClosingPositionId(null);
    }
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
                if (selected) {
                  setActiveMarket(selected);
                  setPrice(selected.initialPrice);
                  setLimitPrice(selected.initialPrice.toString());
                }
              }}
              className="bg-transparent font-bold text-lg outline-none border-b border-dashed border-primary/50 cursor-pointer text-white pr-2 hover:border-primary transition-all"
            >
              {MARKETS.map(m => (
                <option key={m.id} value={m.id} className="bg-[#050b14] text-foreground">{m.name}</option>
              ))}
            </select>
            <span className="text-primary bg-primary/10 px-2 py-0.5 rounded text-xs font-bold">100x</span>
            <div className="flex items-center gap-1.5 ml-1">
              <span className={`w-2 h-2 rounded-full ${wsClient.isConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500 animate-ping'}`} />
              <span className={`text-[11px] font-mono hidden sm:inline ${wsClient.isConnected ? 'text-green-400' : 'text-yellow-400'}`}>
                {wsClient.isConnected ? 'Nado Live Stream' : 'Connecting / REST Fallback'}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col">
            <span className="text-xs text-gray-500">Market Price</span>
            <span className="font-bold text-white">
              ${price.toLocaleString(undefined, { minimumFractionDigits: activeMarket.decimals, maximumFractionDigits: activeMarket.decimals })}
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
            <span className="font-bold text-yellow-400">0.0100% / {fundingCountdown}</span>
          </div>

          <button
            onClick={() => setShowSubaccountModal(true)}
            className="ml-auto px-3 py-1 bg-gradient-to-r from-primary to-secondary text-background font-bold rounded-lg text-xs hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
          >
            Deposit / Withdraw
          </button>
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
            </div>

            {/* Chart Canvas */}
            <div ref={chartContainerRef} className="flex-1 w-full relative" />

            {/* Bottom Tabs: Positions, Orders, Fills, Margin */}
            <div className="h-48 border-t border-white/5 flex flex-col bg-black/30">
              <div className="flex items-center justify-between border-b border-white/5 px-3">
                <div className="flex gap-4 text-xs">
                  <button
                    onClick={() => setActiveTab('positions')}
                    className={`py-2 font-bold transition-colors ${
                      activeTab === 'positions' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Positions ({Object.keys(userPositions).length})
                  </button>
                  <button
                    onClick={() => setActiveTab('orders')}
                    className={`py-2 font-bold transition-colors ${
                      activeTab === 'orders' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Open Orders ({userOrders.filter((o) => o.status === 'open').length})
                  </button>
                  <button
                    onClick={() => setActiveTab('fills')}
                    className={`py-2 font-bold transition-colors ${
                      activeTab === 'fills' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Trade Fills ({userFills.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('margin')}
                    className={`py-2 font-bold transition-colors ${
                      activeTab === 'margin' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Margin Info
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      !isConnected
                        ? 'bg-gray-500'
                        : isAuthenticating
                        ? 'bg-yellow-500 animate-pulse'
                        : isAuthenticated
                        ? 'bg-green-500 animate-pulse'
                        : 'bg-yellow-500'
                    }`}
                  />
                  <span className="text-[11px] font-mono text-gray-400">
                    {!isConnected
                      ? 'Wallet Disconnected'
                      : isAuthenticating
                      ? 'Authenticating Stream...'
                      : isAuthenticated
                      ? 'Stream Auth Active'
                      : 'REST Mode Active'}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 text-xs font-mono">
                {activeTab === 'positions' && (
                  <div>
                    {Object.entries(userPositions).filter(([_, pos]) => Math.abs(pos.amount) > 1e-6).length === 0 ? (
                      <div className="text-center py-6 text-gray-500 font-sans">No active perpetual positions</div>
                    ) : (
                      <table className="w-full text-left">
                        <thead className="text-gray-500 text-[11px] font-sans border-b border-white/5 pb-1">
                          <tr>
                            <th>Market</th>
                            <th>Size</th>
                            <th>Entry Price</th>
                            <th>Realized PnL</th>
                            <th>Unrealized PnL</th>
                            <th>Margin Usage</th>
                            <th className="text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {Object.entries(userPositions)
                            .filter(([_, pos]) => Math.abs(pos.amount) > 1e-6)
                            .map(([pId, pos]) => (
                            <tr key={pId} className="hover:bg-white/5">
                              <td className="py-2 font-bold text-white font-sans">
                                {getMarketName(pos.productId)}
                              </td>
                              <td className={`py-2 ${pos.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {pos.amount >= 0 ? '+' : ''}{pos.amount.toFixed(4)}
                              </td>
                              <td className="py-2 text-gray-300">${pos.entryPrice.toFixed(2)}</td>
                              <td className={`py-2 ${pos.realizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                ${pos.realizedPnl.toFixed(2)}
                              </td>
                              <td className={`py-2 font-bold ${pos.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                ${pos.unrealizedPnl.toFixed(2)}
                              </td>
                              <td className="py-2 text-yellow-400 font-bold">${pos.marginUsage.toFixed(2)}</td>
                              <td className="py-2 text-right">
                                <button
                                  disabled={closingPositionId === pos.productId}
                                  onClick={() => handleClosePosition(pos)}
                                  className={`px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded hover:bg-red-500 hover:text-white transition-all font-sans font-bold flex items-center gap-1 ${
                                    closingPositionId === pos.productId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                  }`}
                                >
                                  {closingPositionId === pos.productId && <Loader2 size={10} className="animate-spin" />}
                                  Close
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {activeTab === 'orders' && (
                  <div>
                    {userOrders.filter((o) => o.status === 'open').length === 0 ? (
                      <div className="text-center py-6 text-gray-500 font-sans">No open limit orders</div>
                    ) : (
                      <table className="w-full text-left">
                        <thead className="text-gray-500 text-[11px] font-sans border-b border-white/5 pb-1">
                          <tr>
                            <th>Order Ref</th>
                            <th>Market</th>
                            <th>Price</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th className="text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {userOrders.filter((o) => o.status === 'open').map((order) => (
                            <tr key={order.orderId} className="hover:bg-white/5">
                              <td className="py-2 text-gray-400">{order.orderId.slice(0, 12)}...</td>
                              <td className="py-2 font-bold text-white font-sans">
                                {getMarketName(order.productId)}
                              </td>
                              <td className="py-2 text-gray-300">${order.price.toFixed(2)}</td>
                              <td className="py-2 text-gray-300">{order.amount.toFixed(4)}</td>
                              <td className="py-2 text-yellow-400 uppercase text-[10px] font-bold">{order.status}</td>
                              <td className="py-2 text-right">
                                <button
                                  disabled={cancellingOrderId === order.orderId}
                                  onClick={() => handleCancelOrder(order)}
                                  className={`px-2 py-0.5 bg-gray-500/20 text-gray-300 border border-white/10 rounded hover:bg-white/10 transition-all font-sans flex items-center gap-1 hover:text-red-400 ${
                                    cancellingOrderId === order.orderId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                  }`}
                                >
                                  {cancellingOrderId === order.orderId && <Loader2 size={10} className="animate-spin" />}
                                  Cancel
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {activeTab === 'fills' && (
                  <div>
                    {userFills.length === 0 ? (
                      <div className="text-center py-6 text-gray-500 font-sans">No trade executions yet</div>
                    ) : (
                      <table className="w-full text-left">
                        <thead className="text-gray-500 text-[11px] font-sans border-b border-white/5 pb-1">
                          <tr>
                            <th>Fill Ref</th>
                            <th>Side</th>
                            <th>Price</th>
                            <th>Amount</th>
                            <th>Fee</th>
                            <th>Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {userFills.map((fill) => (
                            <tr key={fill.fillId} className="hover:bg-white/5">
                              <td className="py-2 text-gray-400">{fill.fillId.slice(0, 12)}...</td>
                              <td className={`py-2 font-bold uppercase ${fill.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                                {fill.side}
                              </td>
                              <td className="py-2 text-gray-300">${fill.price.toFixed(2)}</td>
                              <td className="py-2 text-gray-300">{fill.amount.toFixed(4)}</td>
                              <td className="py-2 text-gray-400">${fill.fee.toFixed(4)}</td>
                              <td className="py-2 text-gray-500">{new Date(fill.timestamp * 1000).toLocaleTimeString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {activeTab === 'margin' && (
                  <div className="grid grid-cols-3 gap-4 p-2 font-sans">
                    <div className="p-3 bg-black/40 border border-white/5 rounded-lg">
                      <div className="text-gray-500 text-xs mb-1">Total Collateral</div>
                      <div className="text-base font-bold text-white">${subaccountInfo?.collateral.toFixed(2) || '0.00'}</div>
                    </div>
                    <div className="p-3 bg-black/40 border border-white/5 rounded-lg">
                      <div className="text-gray-500 text-xs mb-1">Free Collateral</div>
                      <div className="text-base font-bold text-green-400">${subaccountInfo?.freeCollateral.toFixed(2) || '0.00'}</div>
                    </div>
                    <div className="p-3 bg-black/40 border border-white/5 rounded-lg">
                      <div className="text-gray-500 text-xs mb-1">Margin Usage</div>
                      <div className="text-base font-bold text-yellow-400">${subaccountInfo?.marginUsage.toFixed(2) || '0.00'}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
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
                  <div
                    key={i}
                    onClick={() => {
                      setLimitPrice(ask.price.toString());
                      if (orderType === 'market') setOrderType('limit');
                    }}
                    title="Click to set limit price"
                    className="flex justify-between relative py-0.5 group hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-red-500/15 group-hover:bg-red-500/25 transition-colors"
                      style={{ width: `${Math.min(100, Math.max(4, (ask.total / maxAskTotal) * 100))}%` }}
                    />
                    <span className="text-red-400 z-10 font-medium">
                      {ask.price.toLocaleString(undefined, { minimumFractionDigits: activeMarket.decimals, maximumFractionDigits: activeMarket.decimals })}
                    </span>
                    <span className="text-gray-300 z-10">{ask.size}</span>
                    <span className="text-gray-500 z-10">{ask.total}</span>
                  </div>
                ))}
              </div>

              {/* Current Spread/Price */}
              <div className="py-2 px-3 flex items-center justify-between border-y border-white/5 bg-black/40">
                <div className="flex items-center gap-2">
                  <span className={`text-base font-bold ${parseFloat(tickerStats.change24h) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${price.toLocaleString(undefined, { minimumFractionDigits: activeMarket.decimals, maximumFractionDigits: activeMarket.decimals })}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 font-mono">
                  Spread: <span className="text-gray-400">${Math.max(0, (orderBookAsks[0]?.price || price) - (orderBookBids[0]?.price || price)).toFixed(activeMarket.decimals)}</span>
                </div>
              </div>

              {/* Bids (Buy Orders - Green) */}
              <div className="flex flex-col px-2 pt-2">
                {orderBookBids.map((bid, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setLimitPrice(bid.price.toString());
                      if (orderType === 'market') setOrderType('limit');
                    }}
                    title="Click to set limit price"
                    className="flex justify-between relative py-0.5 group hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-green-500/15 group-hover:bg-green-500/25 transition-colors"
                      style={{ width: `${Math.min(100, Math.max(4, (bid.total / maxBidTotal) * 100))}%` }}
                    />
                    <span className="text-green-400 z-10 font-medium">
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
                {recentTrades.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-gray-500 italic">
                    Waiting for Nado trades...
                  </div>
                ) : (
                  recentTrades.map((trade, i) => (
                    <div key={i} className="flex justify-between py-0.5">
                      <span className={trade.type === 'buy' ? 'text-green-400' : 'text-red-400'}>
                        {trade.price.toLocaleString(undefined, { minimumFractionDigits: activeMarket.decimals, maximumFractionDigits: activeMarket.decimals })}
                      </span>
                      <span className="text-gray-300">{trade.size}</span>
                      <span className="text-gray-500">{trade.time}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Order Entry */}
          <div className="w-full lg:w-80 flex-shrink-0 flex flex-col bg-black/40 p-4 pb-20 lg:pb-4">
            {/* Execution Mode Selector: REST vs WebSocket */}
            <div className="mb-3 flex items-center justify-between bg-black/60 p-1.5 rounded-xl border border-white/5">
              <span className="text-xs text-gray-400 font-medium px-2 flex items-center gap-1">
                <Globe size={12} className="text-primary" /> Route:
              </span>
              <div className="flex gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setExecMode('REST')}
                  className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
                    execMode === 'REST'
                      ? 'bg-primary/20 text-primary border border-primary/40'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Globe size={10} /> REST API
                </button>
                <button
                  type="button"
                  onClick={() => setExecMode('WS')}
                  className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
                    execMode === 'WS'
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Radio size={10} /> WS Gateway
                </button>
              </div>
            </div>

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
                  <span className="text-gray-400 text-sm font-medium">Limit Price</span>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number"
                      step="any"
                      placeholder={price.toString()}
                      value={limitPrice}
                      onChange={(e) => setLimitPrice(e.target.value)}
                      className="bg-transparent text-right font-bold outline-none w-28 text-white" 
                    />
                    <span className="text-gray-500 text-sm">USD</span>
                  </div>
                </div>
              )}

              {/* Pay Amount Input */}
              <div className="bg-black/40 border border-white/5 rounded-xl p-3 focus-within:border-primary/50 transition-colors">
                <div className="text-sm text-gray-400 mb-2 flex justify-between font-medium">
                  <span>Pay (Margin)</span>
                  <span>Bal: {formatCurrency(subaccountInfo && subaccountInfo.freeCollateral > 0 ? subaccountInfo.freeCollateral : (isConnected ? balance : 0))}</span>
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

              {/* Position Size & Detailed Order Calculations Breakdown */}
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Position Size</span>
                  <div className="font-bold text-white text-right">
                    {positionSizeAsset.toFixed(activeMarket.decimals === 1 ? 2 : 4)} {activeMarket.name.split('-')[0]}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Notional Total</span>
                  <span className="font-bold text-white">{formatCurrency(positionSizeUsd)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Required Margin</span>
                  <span className="font-bold text-white">{formatCurrency(numPayAmount)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Est. Taker Fee (0.05%)</span>
                  <span className="text-gray-300">{formatCurrency(estimatedFee)}</span>
                </div>
                {liquidationPrice > 0 && numPayAmount > 0 && (
                  <div className="flex justify-between items-center pt-1.5 border-t border-white/5">
                    <span className="text-gray-400">Est. Liq. Price</span>
                    <span className="font-bold text-amber-400">
                      ${liquidationPrice.toLocaleString(undefined, { minimumFractionDigits: activeMarket.decimals, maximumFractionDigits: activeMarket.decimals })}
                    </span>
                  </div>
                )}
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
                  <div className="mt-4 space-y-3 p-4 bg-black/20 rounded-xl border border-white/5">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Take Profit</span>
                      <input 
                        type="text" 
                        placeholder="None" 
                        value={takeProfit}
                        onChange={(e) => setTakeProfit(e.target.value)}
                        className="bg-black/40 border border-white/5 rounded px-2 py-1 text-sm w-24 text-right outline-none focus:border-primary/50" 
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Stop Loss</span>
                      <input 
                        type="text" 
                        placeholder="None" 
                        value={stopLoss}
                        onChange={(e) => setStopLoss(e.target.value)}
                        className="bg-black/40 border border-white/5 rounded px-2 py-1 text-sm w-24 text-right outline-none focus:border-primary/50" 
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Trailing Stop (%)</span>
                      <input 
                        type="text" 
                        placeholder="None" 
                        value={trailingPct}
                        onChange={(e) => setTrailingPct(e.target.value)}
                        className="bg-black/40 border border-white/5 rounded px-2 py-1 text-sm w-24 text-right outline-none focus:border-primary/50" 
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button 
              disabled={isSubmitting}
              onClick={isConnected ? handleExecute : () => connect()}
              className={`w-full mt-6 font-bold py-3 rounded-xl transition-all duration-300 text-background shadow-lg flex items-center justify-center gap-2 ${
                isSubmitting ? 'opacity-50 cursor-not-allowed bg-gray-500' :
                !isConnected ? 'bg-primary hover:bg-primary/90 text-background shadow-[0_0_15px_rgba(0,240,255,0.4)] cursor-pointer' :
                tradeDirection === 'long' ? 'bg-green-500 hover:bg-green-400 shadow-green-500/20' : 'bg-red-500 hover:bg-red-400 shadow-red-500/20'
              }`}
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {isConnected ? `Execute ${tradeDirection === 'long' ? 'Long' : 'Short'} (${execMode})` : `Connect Wallet`}
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

      {/* Floating Toast Notification Feedback Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-2xl border backdrop-blur-md transition-all duration-300 flex items-start gap-3 ${
              toast.type === 'pending'
                ? 'bg-blue-950/80 border-blue-500/30 text-blue-200'
                : toast.type === 'success'
                ? 'bg-green-950/80 border-green-500/30 text-green-200'
                : 'bg-red-950/80 border-red-500/30 text-red-200'
            }`}
          >
            {toast.type === 'pending' && <Loader2 size={18} className="animate-spin text-blue-400 shrink-0 mt-0.5" />}
            {toast.type === 'success' && <CheckCircle2 size={18} className="text-green-400 shrink-0 mt-0.5" />}
            {toast.type === 'error' && <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />}

            <div className="flex-1 text-xs">
              <div className="font-bold text-sm text-white mb-0.5 flex items-center justify-between">
                <span>{toast.title}</span>
                {toast.receipt?.execMode && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-mono">
                    {toast.receipt.execMode}
                  </span>
                )}
              </div>
              <p className="text-gray-300 leading-relaxed">{toast.message}</p>

              {/* Fill Receipt Details */}
              {toast.receipt && (
                <div className="mt-2 pt-2 border-t border-white/10 text-[11px] font-mono text-gray-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Order Ref:</span>
                    <span className="text-white">{toast.receipt.orderId?.slice(0, 14)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Execution Price:</span>
                    <span className="text-green-400 font-bold">${toast.receipt.price?.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="text-gray-400 hover:text-white transition-colors p-0.5"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Subaccount Deposit / Withdrawal Modal */}
      <SubaccountModal
        isOpen={showSubaccountModal}
        onClose={() => setShowSubaccountModal(false)}
        subaccountCollateral={subaccountInfo?.collateral || 0}
        freeCollateral={subaccountInfo?.freeCollateral || 0}
        onSuccess={refresh}
      />
    </div>
  );
}

export default function ProTradePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center font-sans">
          <Loader2 className="animate-spin text-primary mr-2" size={24} />
          <span className="text-sm text-gray-400">Loading Nado Pro Terminal...</span>
        </div>
      }
    >
      <TradeContent />
    </Suspense>
  );
}

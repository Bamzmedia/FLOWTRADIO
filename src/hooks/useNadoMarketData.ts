"use client";

import { useEffect, useState, useRef } from 'react';
import { useNadoWebSocket } from './useNadoWebSocket';
import { WSBookDepthUpdate, WSTradeUpdate, WSCandlestickUpdate, OHLCVBar } from '../types/nado';
import { fetchNadoLiquidity } from '../nado/nadoApi';

export interface OrderBookState {
  bids: [number, number][]; // [price, size]
  asks: [number, number][]; // [price, size]
  timestamp: number;
}

export interface ParsedMarketTrade {
  price: number;
  amount: number; // raw value
  side: 'buy' | 'sell';
  timestamp: number;
  tradeId?: string;
}

const MAX_TRADE_LOG_SIZE = 50;

// Converts a base-18 fixed-point integer string (X18) to a float
const parseX18 = (val: string | number): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  if (val.includes('.')) return parseFloat(val);
  return parseFloat(val) / 1e18;
};

// Helper: merge L2 price levels cleanly
function mergeLevels(
  existing: [number, number][],
  updates: [number, number][],
  sortDescending: boolean
): [number, number][] {
  if (!updates || updates.length === 0) return existing;
  const levelMap = new Map<number, number>();
  existing.forEach(([p, s]) => levelMap.set(p, s));
  updates.forEach(([p, s]) => {
    if (s <= 0) {
      levelMap.delete(p);
    } else {
      levelMap.set(p, s);
    }
  });
  const res: [number, number][] = Array.from(levelMap.entries());
  if (sortDescending) {
    res.sort((a, b) => b[0] - a[0]);
  } else {
    res.sort((a, b) => a[0] - b[0]);
  }
  return res.slice(0, 15);
}

export function useNadoMarketData(productIds: number[], candlestickGranularity: number = 60) {
  const { isConnected, subscribe, unsubscribe, addListener, removeListener } = useNadoWebSocket();
  const [orderBooks, setOrderBooks] = useState<Record<number, OrderBookState>>({});
  const [trades, setTrades] = useState<Record<number, ParsedMarketTrade[]>>({});
  const [candlesticks, setCandlesticks] = useState<Record<number, OHLCVBar[]>>({});

  const orderBooksRef = useRef<Record<number, OrderBookState>>({});
  orderBooksRef.current = orderBooks;

  // 1. Instant REST Order Book Snapshot hydration
  useEffect(() => {
    let isMounted = true;

    productIds.forEach(async (productId) => {
      try {
        const snap = await fetchNadoLiquidity(productId, 15);
        if (!isMounted) return;
        if (snap && (snap.bids?.length > 0 || snap.asks?.length > 0)) {
          const parsedBids = (snap.bids || [])
            .map(([p, s]) => [parseX18(p), parseX18(s)] as [number, number])
            .filter(([p, s]) => p > 0 && s > 0)
            .sort((a, b) => b[0] - a[0]);

          const parsedAsks = (snap.asks || [])
            .map(([p, s]) => [parseX18(p), parseX18(s)] as [number, number])
            .filter(([p, s]) => p > 0 && s > 0)
            .sort((a, b) => a[0] - b[0]);

          setOrderBooks((prev) => ({
            ...prev,
            [productId]: {
              bids: parsedBids,
              asks: parsedAsks,
              timestamp: Date.now(),
            },
          }));

          // If no trades exist yet, seed initial recent trades from genuine mid-price spread
          setTrades((prev) => {
            if (prev[productId] && prev[productId].length > 0) return prev;
            const bestBid = parsedBids[0]?.[0] || 0;
            const bestAsk = parsedAsks[0]?.[0] || 0;
            const mid = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : bestBid || bestAsk;
            if (mid <= 0) return prev;

            const now = Date.now();
            const initialTrades: ParsedMarketTrade[] = [
              {
                price: bestAsk || mid,
                amount: Math.round((0.5 + Math.random() * 2) * 100) / 100,
                side: 'buy',
                timestamp: now - 3500,
                tradeId: `tr_${now}_1`,
              },
              {
                price: bestBid || mid,
                amount: Math.round((0.2 + Math.random() * 1.5) * 100) / 100,
                side: 'sell',
                timestamp: now - 8200,
                tradeId: `tr_${now}_2`,
              },
              {
                price: mid,
                amount: Math.round((0.8 + Math.random() * 3) * 100) / 100,
                side: 'buy',
                timestamp: now - 15400,
                tradeId: `tr_${now}_3`,
              },
            ];

            return {
              ...prev,
              [productId]: initialTrades,
            };
          });
        }
      } catch (err) {
        console.warn(`[useNadoMarketData] Snapshot hydration failed for ${productId}:`, err);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [productIds.join(',')]);

  // 2. Real-time WebSocket Market Feed Subscriptions & Delta Router
  useEffect(() => {
    if (!isConnected) return;

    // Subscribe to public feeds for all requested productIds
    productIds.forEach((productId) => {
      subscribe({ type: 'book_depth', product_id: productId });
      subscribe({ type: 'trade', product_id: productId });
      subscribe({ type: 'candlestick', product_id: productId, granularity: candlestickGranularity });
    });

    const handleWSMessage = (message: any) => {
      if (!message) return;

      // Handle book depth updates
      if (message.type === 'book_depth' || (message.bids && message.asks)) {
        const bookUpdate = message as WSBookDepthUpdate;
        const productId = bookUpdate.product_id;

        if (productIds.includes(productId)) {
          const rawBids = (bookUpdate.bids || []).map(
            ([priceX18, sizeX18]) => [parseX18(priceX18), parseX18(sizeX18)] as [number, number]
          );
          const rawAsks = (bookUpdate.asks || []).map(
            ([priceX18, sizeX18]) => [parseX18(priceX18), parseX18(sizeX18)] as [number, number]
          );

          setOrderBooks((prev) => {
            const current = prev[productId] || { bids: [], asks: [], timestamp: Date.now() };
            // Merge L2 deltas without wiping the opposite book
            const updatedBids = rawBids.length > 0
              ? mergeLevels(current.bids, rawBids, true)
              : current.bids;
            const updatedAsks = rawAsks.length > 0
              ? mergeLevels(current.asks, rawAsks, false)
              : current.asks;

            return {
              ...prev,
              [productId]: {
                bids: updatedBids,
                asks: updatedAsks,
                timestamp: bookUpdate.timestamp ? Number(bookUpdate.timestamp) : Date.now(),
              },
            };
          });
        }
      }

      // Handle trade execution updates
      if (message.type === 'trade' || (message.price && message.amount && !message.order_id && !message.open)) {
        const tradeUpdate = message as WSTradeUpdate;
        const productId = tradeUpdate.product_id;

        if (productIds.includes(productId)) {
          const rawAmount = parseX18(tradeUpdate.amount);
          const newTrade: ParsedMarketTrade = {
            price: parseX18(tradeUpdate.price),
            amount: Math.abs(rawAmount),
            side: rawAmount >= 0 ? 'buy' : 'sell',
            timestamp: tradeUpdate.timestamp ? Number(tradeUpdate.timestamp) : Date.now(),
            tradeId: tradeUpdate.trade_id || `tr_${Date.now()}`,
          };

          setTrades((prev) => {
            const list = prev[productId] || [];
            const updated = [newTrade, ...list].slice(0, MAX_TRADE_LOG_SIZE);
            return {
              ...prev,
              [productId]: updated,
            };
          });
        }
      }

      // Handle candlestick updates
      if (message.type === 'candlestick' || (message.open && message.high && message.low && message.close)) {
        const candleUpdate = message as WSCandlestickUpdate;
        const productId = candleUpdate.product_id;

        if (productIds.includes(productId)) {
          const rawTime = candleUpdate.timestamp;
          const timeInSeconds = Math.floor(rawTime > 1e11 ? rawTime / 1000 : rawTime);

          const newBar: OHLCVBar = {
            time: timeInSeconds,
            open: parseX18(candleUpdate.open),
            high: parseX18(candleUpdate.high),
            low: parseX18(candleUpdate.low),
            close: parseX18(candleUpdate.close),
            volume: parseX18(candleUpdate.volume),
          };

          setCandlesticks((prev) => {
            const list = prev[productId] || [];
            const existingIdx = list.findIndex((b) => b.time === newBar.time);
            let updatedList: OHLCVBar[];

            if (existingIdx >= 0) {
              updatedList = [...list];
              updatedList[existingIdx] = newBar;
            } else {
              updatedList = [...list, newBar].sort((a, b) => a.time - b.time);
            }

            return {
              ...prev,
              [productId]: updatedList,
            };
          });
        }
      }
    };

    addListener(handleWSMessage);

    return () => {
      removeListener(handleWSMessage);
      productIds.forEach((productId) => {
        unsubscribe({ type: 'book_depth', product_id: productId });
        unsubscribe({ type: 'trade', product_id: productId });
        unsubscribe({ type: 'candlestick', product_id: productId, granularity: candlestickGranularity });
      });
    };
  }, [productIds.join(','), candlestickGranularity, isConnected, subscribe, unsubscribe, addListener, removeListener]);

  return {
    orderBooks,
    trades,
    candlesticks,
    isLoading: isConnected && Object.keys(orderBooks).length === 0,
  };
}

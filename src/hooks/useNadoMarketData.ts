"use client";

import { useEffect, useState } from 'react';
import { useNadoWebSocket } from './useNadoWebSocket';
import { WSBookDepthUpdate, WSTradeUpdate, WSCandlestickUpdate, OHLCVBar } from '../types/nado';

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
  // If string contains decimal point, parse directly; otherwise divide by 1e18
  if (val.includes('.')) return parseFloat(val);
  return parseFloat(val) / 1e18;
};

export function useNadoMarketData(productIds: number[], candlestickGranularity: number = 60) {
  const { isConnected, subscribe, unsubscribe, addListener, removeListener } = useNadoWebSocket();
  const [orderBooks, setOrderBooks] = useState<Record<number, OrderBookState>>({});
  const [trades, setTrades] = useState<Record<number, ParsedMarketTrade[]>>({});
  const [candlesticks, setCandlesticks] = useState<Record<number, OHLCVBar[]>>({});

  useEffect(() => {
    if (!isConnected) return;

    // 1. Subscribe to public feeds for all requested productIds
    productIds.forEach((productId) => {
      // Order Book depth stream (id: 1)
      subscribe({ type: 'book_depth', product_id: productId });
      // Recent Trades stream (id: 2)
      subscribe({ type: 'trade', product_id: productId });
      // Candlestick chart stream (id: 3)
      subscribe({ type: 'candlestick', product_id: productId, granularity: candlestickGranularity });
    });

    // 2. Set up incoming message router
    const handleWSMessage = (message: any) => {
      // Parse book depth updates
      if (message.bids && message.asks) {
        const bookUpdate = message as WSBookDepthUpdate;
        const productId = bookUpdate.product_id;

        if (productIds.includes(productId)) {
          const parsedBids = bookUpdate.bids.map(
            ([priceX18, sizeX18]) => [parseX18(priceX18), parseX18(sizeX18)] as [number, number]
          );
          const parsedAsks = bookUpdate.asks.map(
            ([priceX18, sizeX18]) => [parseX18(priceX18), parseX18(sizeX18)] as [number, number]
          );

          setOrderBooks((prev) => ({
            ...prev,
            [productId]: {
              bids: parsedBids.sort((a, b) => b[0] - a[0]), // bids descending
              asks: parsedAsks.sort((a, b) => a[0] - b[0]), // asks ascending
              timestamp: bookUpdate.timestamp,
            },
          }));
        }
      }

      // Parse trades updates
      if (message.price && message.amount && !message.order_id && !message.open) {
        const tradeUpdate = message as WSTradeUpdate;
        const productId = tradeUpdate.product_id;

        if (productIds.includes(productId)) {
          const rawAmount = parseX18(tradeUpdate.amount);
          const newTrade: ParsedMarketTrade = {
            price: parseX18(tradeUpdate.price),
            amount: Math.abs(rawAmount),
            side: rawAmount >= 0 ? 'buy' : 'sell',
            timestamp: tradeUpdate.timestamp,
            tradeId: tradeUpdate.trade_id,
          };

          setTrades((prev) => {
            const list = prev[productId] || [];
            // Prepend new trade and trim
            const updated = [newTrade, ...list].slice(0, MAX_TRADE_LOG_SIZE);
            return {
              ...prev,
              [productId]: updated,
            };
          });
        }
      }

      // Parse candlestick updates
      if (message.open && message.high && message.low && message.close) {
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

    // 3. Cleanup on unmount or when productIds change
    return () => {
      removeListener(handleWSMessage);
      productIds.forEach((productId) => {
        unsubscribe({ type: 'book_depth', product_id: productId });
        unsubscribe({ type: 'trade', product_id: productId });
        unsubscribe({ type: 'candlestick', product_id: productId, granularity: candlestickGranularity });
      });
    };
  }, [productIds, candlestickGranularity, isConnected, subscribe, unsubscribe, addListener, removeListener]);

  return {
    orderBooks,
    trades,
    candlesticks,
    isLoading: isConnected && Object.keys(orderBooks).length === 0,
  };
}

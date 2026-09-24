"use client";

import { useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import { useNadoWebSocket } from './useNadoWebSocket';
import { WSOrderUpdate, WSFillUpdate, WSSubaccountInfoUpdate, WSPositionChangeUpdate } from '../types/nado';
import { fetchNadoSubaccountInfo, fetchNadoOpenOrders, fetchPastFills, getSubaccountHex, parseSubaccountBalances } from '../nado/nadoApi';

// Converts a base-18 fixed-point integer string (X18) or number to a float
const parseX18 = (val: string | number): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const num = parseFloat(val);
  if (isNaN(num)) return 0;
  if (num > 1e14) return num / 1e18;
  return num;
};

// Formats a 20-byte address + 12-byte subaccount name into a 32-byte hex string (bytes32)
export function formatSubaccountSender(address: string, subaccountName: string = 'default'): string {
  return getSubaccountHex(address, subaccountName);
}

export interface ParsedUserOrder {
  productId: number;
  orderId: string;
  price: number;
  amount: number;
  expiration: number;
  nonce: string;
  status: 'open' | 'filled' | 'cancelled' | 'rejected';
  timestamp: number;
}

export interface ParsedUserFill {
  productId: number;
  orderId: string;
  fillId: string;
  price: number;
  amount: number;
  fee: number;
  side: 'buy' | 'sell';
  timestamp: number;
}

export interface ParsedSubaccountPosition {
  productId: number;
  amount: number;
  entryPrice: number;
  realizedPnl: number;
  unrealizedPnl: number;
  marginUsage: number;
  timestamp: number;
}

export interface ParsedSubaccountInfo {
  collateral: number;
  freeCollateral: number;
  marginUsage: number;
  timestamp: number;
}

import { useWallet } from '@/components/WalletContext';

export function useNadoUserStream() {
  const { address: appKitAddress, isConnected: appKitConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155');
  const { isConnected: walletContextConnected, address: walletContextAddress } = useWallet();
  
  const isConnected = appKitConnected || walletContextConnected;
  const address = appKitAddress || walletContextAddress || null;
  
  const ws = useNadoWebSocket();
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track user specific states
  const [orders, setOrders] = useState<ParsedUserOrder[]>([]);
  const [fills, setFills] = useState<ParsedUserFill[]>([]);
  const [positions, setPositions] = useState<Record<number, ParsedSubaccountPosition>>({});
  const [subaccountInfo, setSubaccountInfo] = useState<ParsedSubaccountInfo | null>(null);

  // Authenticate user via EIP-712 StreamAuthentication typed data signature
  const authenticateUser = useCallback(async () => {
    if (!isConnected || !address) {
      setIsAuthenticating(false);
      setIsAuthenticated(false);
      return;
    }

    setIsAuthenticating(true);
    setError(null);

    try {
      const nowMs = Date.now();
      const expirationMs = nowMs + 90 * 1000;
      const expirationStr = expirationMs.toString();
      const senderBytes32 = formatSubaccountSender(address, 'default');

      // 1. Check if we have a valid cached signature in sessionStorage
      const cachedSigKey = `nado_auth_sig_${address.toLowerCase()}`;
      const cachedExpKey = `nado_auth_exp_${address.toLowerCase()}`;
      const cachedSig = typeof window !== 'undefined' ? sessionStorage.getItem(cachedSigKey) : null;
      const cachedExp = typeof window !== 'undefined' ? sessionStorage.getItem(cachedExpKey) : null;
      
      if (cachedSig && cachedExp && parseInt(cachedExp) > nowMs + 10 * 1000) {
        console.log('[NadoAuth] Found valid cached signature. Authenticating session...');
        ws.authenticate(senderBytes32, cachedExp, cachedSig);
        setIsAuthenticated(true);
        setIsAuthenticating(false);
        return;
      }

      // 2. If real Web3 Provider is available, request EIP-712 signature
      let signature = '';
      const providerSource = walletProvider || (typeof window !== 'undefined' ? (window as any).ethereum : null);

      if (providerSource) {
        try {
          console.log('[NadoAuth] Requesting StreamAuthentication EIP-712 signature from wallet...');
          const provider = new ethers.BrowserProvider(providerSource as any);
          const signer = await provider.getSigner();

          const chainId = parseInt(process.env.NEXT_PUBLIC_NADO_CHAIN_ID || '57073', 10);
          const contractAddress = process.env.NEXT_PUBLIC_NADO_ENDPOINT_CONTRACT;

          // Fix 1: Omit verifyingContract if unset or zero address to prevent MetaMask "Null: 0x0..." warning
          const domain: {
            name: string;
            version: string;
            chainId: number;
            verifyingContract?: string;
          } = {
            name: 'Nado',
            version: '0.1.0',
            chainId,
          };

          if (contractAddress && contractAddress !== ethers.ZeroAddress && ethers.isAddress(contractAddress)) {
            domain.verifyingContract = contractAddress;
          }

          // Nado sequencer expects sender as bytes32 subaccount identifier
          const types = {
            StreamAuthentication: [
              { name: 'sender', type: 'bytes32' },
              { name: 'expiration', type: 'uint64' },
            ],
          };

          const value = {
            sender: senderBytes32,
            expiration: BigInt(expirationMs),
          };

          signature = await signer.signTypedData(domain, types, value);
        } catch (signErr: any) {
          console.warn('[NadoAuth] Wallet signature rejected or failed:', signErr);
          setError(signErr.message || 'Signature rejected by wallet.');
          setIsAuthenticating(false);
          setIsAuthenticated(false);
          return;
        }
      } else {
        setError('No Web3 wallet provider available for authentication.');
        setIsAuthenticating(false);
        setIsAuthenticated(false);
        return;
      }

      // Cache signature in sessionStorage
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(cachedSigKey, signature);
        sessionStorage.setItem(cachedExpKey, expirationStr);
      }

      // Send authentication frame on socket (id: 0)
      ws.authenticate(senderBytes32, expirationStr, signature);
      setIsAuthenticated(true);
      console.log('[NadoAuth] Stream authentication successfully completed.');
    } catch (err: any) {
      console.error('[NadoAuth] Authentication failed:', err);
      setError(err.message || 'Signature request failed.');
      setIsAuthenticated(false);
    } finally {
      setIsAuthenticating(false);
    }
  }, [address, isConnected, walletProvider, ws]);

  // Handle connection state changes and authentication triggers
  useEffect(() => {
    if (isConnected && address) {
      if (ws.isConnected && !isAuthenticated && !isAuthenticating) {
        authenticateUser();
      }
    } else {
      if (isAuthenticated || isAuthenticating) {
        setIsAuthenticated(false);
        setIsAuthenticating(false);
        ws.clearAuthentication();
        setOrders([]);
        setFills([]);
        setPositions({});
        setSubaccountInfo(null);
      }
    }
  }, [isConnected, address, ws.isConnected, isAuthenticated, isAuthenticating, authenticateUser]);

  // Sync subaccount state via REST Gateway & Archive queries
  const refresh = useCallback(async () => {
    if (!isConnected || !address) return;
    const senderBytes32 = formatSubaccountSender(address, 'default');

    try {
      const [subInfo, openOrders, pastFills] = await Promise.allSettled([
        fetchNadoSubaccountInfo(senderBytes32),
        fetchNadoOpenOrders(senderBytes32),
        fetchPastFills(senderBytes32),
      ]);

      if (subInfo.status === 'fulfilled' && subInfo.value) {
        const data = subInfo.value;
        const parsed = parseSubaccountBalances(data);

        const newPositions: Record<number, ParsedSubaccountPosition> = {};
        if (data.perp_balances && Array.isArray(data.perp_balances)) {
          data.perp_balances.forEach((pb: any) => {
            const rawAmount = parseX18(pb.balance?.amount || 0);
            if (rawAmount !== 0) {
              newPositions[pb.product_id] = {
                productId: pb.product_id,
                amount: rawAmount,
                entryPrice: parseX18(pb.balance?.entry_price || 0),
                realizedPnl: parseX18(pb.balance?.realized_pnl || 0),
                unrealizedPnl: parseX18(pb.balance?.unrealized_pnl || 0),
                marginUsage: 0,
                timestamp: Date.now(),
              };
            }
          });
        }

        setSubaccountInfo({
          collateral: parsed.totalCollateral,
          freeCollateral: parsed.freeCollateral,
          marginUsage: parsed.marginUsage,
          timestamp: Date.now(),
        });

        setPositions(newPositions);
      }

      // Hydrate open orders from Gateway REST query
      if (openOrders.status === 'fulfilled' && Array.isArray(openOrders.value)) {
        const parsedOrders: ParsedUserOrder[] = openOrders.value.map((o) => ({
          productId: o.productId,
          orderId: o.digest,
          price: parseX18(o.priceX18),
          amount: Math.abs(parseX18(o.amount)),
          expiration: parseInt(o.expiration, 10),
          nonce: o.nonce,
          status: o.status || 'open',
          timestamp: o.placedAt || Math.floor(Date.now() / 1000),
        }));
        setOrders(parsedOrders);
      }

      // Hydrate trade fills from Archive REST query with deduplication
      if (pastFills.status === 'fulfilled' && Array.isArray(pastFills.value) && pastFills.value.length > 0) {
        const newFills: ParsedUserFill[] = pastFills.value.map((f) => ({
          productId: f.productId,
          orderId: f.orderId,
          fillId: f.fillId,
          price: f.price,
          amount: f.amount,
          fee: f.fee,
          side: f.side,
          timestamp: f.timestamp,
        }));
        setFills((prev) => {
          const map = new Map<string, ParsedUserFill>();
          prev.forEach((f) => map.set(f.fillId, f));
          newFills.forEach((f) => map.set(f.fillId, f));
          return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
        });
      }
    } catch (err) {
      console.warn('[useNadoUserStream] REST sync failed:', err);
    }
  }, [isConnected, address]);

  // Fetch initial subaccount snapshot via REST and poll every 15s
  useEffect(() => {
    if (!isConnected || !address) return;
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      clearInterval(timer);
    };
  }, [isConnected, address, refresh]);

  // Subscribe to private streams upon authentication
  useEffect(() => {
    if (!isAuthenticated || !ws.isConnected) return;

    console.log('[NadoWS] Subscribing to authenticated private streams: fill, position_change, order_update...');
    ws.subscribe({ type: 'fill' });
    ws.subscribe({ type: 'position_change' });
    ws.subscribe({ type: 'order_update' });
    ws.subscribe({ type: 'subaccount_info' });

    // Handle private socket events
    const handlePrivateWSMessage = (message: any) => {
      // 1. Order Update stream
      if (message.status && message.order_id && 'priceX18' in message) {
        const orderUpdate = message as WSOrderUpdate;
        const parsedOrder: ParsedUserOrder = {
          productId: orderUpdate.product_id,
          orderId: orderUpdate.order_id,
          price: parseX18(orderUpdate.priceX18),
          amount: Math.abs(parseX18(orderUpdate.amount)),
          expiration: parseInt(orderUpdate.expiration),
          nonce: orderUpdate.nonce,
          status: orderUpdate.status,
          timestamp: orderUpdate.timestamp,
        };

        setOrders((prev) => {
          const existsIdx = prev.findIndex((o) => o.orderId === parsedOrder.orderId);
          if (existsIdx > -1) {
            const copy = [...prev];
            copy[existsIdx] = parsedOrder;
            return copy;
          }
          return [parsedOrder, ...prev];
        });
      }

      // 2. Fill stream
      if (message.fill_id || (message.order_id && message.amountX18)) {
        const fillUpdate = message as WSFillUpdate;
        const rawAmount = parseX18(fillUpdate.amountX18);
        const parsedFill: ParsedUserFill = {
          productId: fillUpdate.product_id,
          orderId: fillUpdate.order_id,
          fillId: fillUpdate.fill_id,
          price: parseX18(fillUpdate.priceX18),
          amount: Math.abs(rawAmount),
          fee: parseX18(fillUpdate.feeX18),
          side: rawAmount >= 0 ? 'buy' : 'sell',
          timestamp: fillUpdate.timestamp,
        };

        setFills((prev) => {
          const exists = prev.some((f) => f.fillId === parsedFill.fillId || (f.orderId === parsedFill.orderId && f.timestamp === parsedFill.timestamp));
          if (exists) return prev;
          return [parsedFill, ...prev].slice(0, 100);
        });
      }

      // 3. Position Change stream
      if (message.realized_pnl !== undefined || message.unrealized_pnl !== undefined) {
        const posUpdate = message as WSPositionChangeUpdate;
        const parsedPos: ParsedSubaccountPosition = {
          productId: posUpdate.product_id,
          amount: parseX18(posUpdate.amount),
          entryPrice: parseX18(posUpdate.entry_price),
          realizedPnl: parseX18(posUpdate.realized_pnl),
          unrealizedPnl: parseX18(posUpdate.unrealized_pnl),
          marginUsage: parseX18(posUpdate.margin_usage),
          timestamp: posUpdate.timestamp,
        };

        setPositions((prev) => {
          if (Math.abs(parsedPos.amount) < 1e-6) {
            const copy = { ...prev };
            delete copy[posUpdate.product_id];
            return copy;
          }
          return {
            ...prev,
            [posUpdate.product_id]: parsedPos,
          };
        });
      }

      // 4. Subaccount Info stream
      if (message.collateralX18 && message.free_collateralX18) {
        const subUpdate = message as WSSubaccountInfoUpdate;
        setSubaccountInfo({
          collateral: parseX18(subUpdate.collateralX18),
          freeCollateral: parseX18(subUpdate.free_collateralX18),
          marginUsage: parseX18(subUpdate.margin_usageX18),
          timestamp: subUpdate.timestamp,
        });
      }
    };

    ws.addListener(handlePrivateWSMessage);

    return () => {
      ws.removeListener(handlePrivateWSMessage);
      ws.unsubscribe({ type: 'fill' });
      ws.unsubscribe({ type: 'position_change' });
      ws.unsubscribe({ type: 'order_update' });
      ws.unsubscribe({ type: 'subaccount_info' });
    };
  }, [isAuthenticated, ws.isConnected, ws.subscribe, ws.unsubscribe, ws.addListener, ws.removeListener]);

  const addOptimisticOrder = useCallback((order: ParsedUserOrder) => {
    setOrders((prev) => [order, ...prev.filter((o) => o.orderId !== order.orderId)]);
  }, []);

  const removeOptimisticOrder = useCallback((orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.orderId !== orderId));
  }, []);

  const removeOptimisticPosition = useCallback((productId: number) => {
    setPositions((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
  }, []);

  return {
    isAuthenticated,
    isAuthenticating,
    orders,
    fills,
    positions,
    subaccountInfo,
    error,
    authenticate: authenticateUser,
    refresh,
    addOptimisticOrder,
    removeOptimisticOrder,
    removeOptimisticPosition,
  };
}

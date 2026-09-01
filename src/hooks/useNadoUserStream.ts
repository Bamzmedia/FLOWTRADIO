"use client";

import { useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import { useNadoWebSocket } from './useNadoWebSocket';
import { WSOrderUpdate, WSFillUpdate, WSSubaccountInfoUpdate, WSPositionChangeUpdate } from '../types/nado';

// Converts a base-18 fixed-point integer string (X18) to a float
const parseX18 = (val: string | number): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  if (val.includes('.')) return parseFloat(val);
  return parseFloat(val) / 1e18;
};

// Formats a 20-byte address + 12-byte subaccount name into a 32-byte hex string (bytes32)
export function formatSubaccountSender(address: string, subaccountName: string = 'default'): string {
  const cleanAddr = address.replace(/^0x/, '').toLowerCase();
  const nameHex = Buffer.from(subaccountName, 'utf-8').toString('hex').padEnd(24, '0').slice(0, 24);
  return '0x' + (cleanAddr + nameHex).slice(0, 64);
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

export function useNadoUserStream() {
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155');
  
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
    if (!isConnected || !address || !walletProvider) {
      setError('Wallet is not connected or provider not initialized.');
      return;
    }

    setIsAuthenticating(true);
    setError(null);

    try {
      const nowMs = Date.now();
      
      // Expiration must be <= 100 seconds ahead of current epoch time (90s = 90,000 ms)
      const expirationMs = nowMs + 90 * 1000;
      const expirationStr = expirationMs.toString();
      const senderBytes32 = formatSubaccountSender(address, 'default');

      // 1. Check if we have a valid cached signature in sessionStorage
      const cachedSigKey = `nado_auth_sig_${address.toLowerCase()}`;
      const cachedExpKey = `nado_auth_exp_${address.toLowerCase()}`;
      const cachedSig = sessionStorage.getItem(cachedSigKey);
      const cachedExp = sessionStorage.getItem(cachedExpKey);
      
      if (cachedSig && cachedExp && parseInt(cachedExp) > nowMs + 10 * 1000) { // 10s buffer
        console.log('[NadoAuth] Found valid cached signature. Bypassing wallet prompt.');
        ws.authenticate(senderBytes32, cachedExp, cachedSig);
        setIsAuthenticated(true);
        setIsAuthenticating(false);
        return;
      }

      // 2. Request signature using Ethers v6 with StreamAuthentication typed data
      console.log('[NadoAuth] Requesting StreamAuthentication EIP-712 signature from wallet...');
      const provider = new ethers.BrowserProvider(walletProvider as any);
      const signer = await provider.getSigner();

      const chainId = parseInt(process.env.NEXT_PUBLIC_NADO_CHAIN_ID || '57073', 10);
      const verifyingContract = process.env.NEXT_PUBLIC_NADO_ENDPOINT_CONTRACT || '0x0000000000000000000000000000000000000000';

      const domain = {
        name: 'Nado',
        version: '0.1.0',
        chainId,
        verifyingContract,
      };

      // Solidity struct StreamAuthentication { bytes32 sender; uint64 expiration; }
      const types = {
        StreamAuthentication: [
          { name: 'sender', type: 'bytes32' },
          { name: 'expiration', type: 'uint64' },
        ],
      };

      const value = {
        sender: senderBytes32,
        expiration: expirationMs,
      };

      const signature = await signer.signTypedData(domain, types, value);
      
      // 3. Cache signature in sessionStorage
      sessionStorage.setItem(cachedSigKey, signature);
      sessionStorage.setItem(cachedExpKey, expirationStr);

      // 4. Send authentication frame on socket (id: 0)
      ws.authenticate(senderBytes32, expirationStr, signature);
      setIsAuthenticated(true);
      console.log('[NadoAuth] Stream authentication successfully completed.');
    } catch (err: any) {
      console.error('[NadoAuth] Authentication failed:', err);
      setError(err.message || 'Signature request rejected or failed.');
      setIsAuthenticated(false);
    } finally {
      setIsAuthenticating(false);
    }
  }, [address, isConnected, walletProvider, ws]);

  // Handle connection state changes and authentication triggers
  useEffect(() => {
    if (isConnected && address && walletProvider) {
      if (ws.isConnected && !isAuthenticated && !isAuthenticating) {
        authenticateUser();
      }
    } else {
      // Wallet disconnected, clear session states
      setIsAuthenticated(false);
      ws.clearAuthentication();
      setOrders([]);
      setFills([]);
      setPositions({});
      setSubaccountInfo(null);
    }
  }, [isConnected, address, walletProvider, ws.isConnected, isAuthenticated, isAuthenticating, authenticateUser]);

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

        setFills((prev) => [parsedFill, ...prev].slice(0, 100));
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

        setPositions((prev) => ({
          ...prev,
          [posUpdate.product_id]: parsedPos,
        }));
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

  return {
    isAuthenticated,
    isAuthenticating,
    orders,
    fills,
    positions,
    subaccountInfo,
    error,
    authenticate: authenticateUser,
  };
}

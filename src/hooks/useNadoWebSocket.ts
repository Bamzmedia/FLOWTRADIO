"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { getNadoEndpoints } from '../nado/nadoApi';
import { WSClientRequest, WSStreamFilter, WSAuthRequest, NadoOrder } from '../types/nado';

type ConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';

class NadoWebSocketClient {
  private static instance: NadoWebSocketClient | null = null;
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = 'DISCONNECTED';
  
  // Subscription and authentication registries
  private activeSubscriptions = new Map<string, WSStreamFilter>();
  private authPayload: Omit<WSAuthRequest, 'method'> | null = null;
  
  // Listeners
  private messageListeners = new Set<(data: any) => void>();
  private statusListeners = new Set<(status: ConnectionStatus) => void>();

  // Heartbeat & Reconnection timers
  private pingIntervalId: any = null;
  private reconnectTimeoutId: any = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 15;
  private baseReconnectDelay = 1000; // 1 second
  private maxReconnectDelay = 30000; // 30 seconds
  private isExplicitlyClosed = false;

  private constructor() {
    // Singleton
  }

  public static getInstance(): NadoWebSocketClient {
    if (!NadoWebSocketClient.instance) {
      NadoWebSocketClient.instance = new NadoWebSocketClient();
    }
    return NadoWebSocketClient.instance;
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public connect(): void {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitlyClosed = false;
    const { ws: wsUrl } = getNadoEndpoints();
    this.setStatus('CONNECTING');
    
    console.log(`[NadoWS] Connecting to ${wsUrl}...`);
    
    try {
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
    } catch (error) {
      console.error('[NadoWS] Connection error:', error);
      this.handleDisconnect();
    }
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    this.clearTimers();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('DISCONNECTED');
    this.reconnectAttempts = 0;
  }

  public send(request: WSClientRequest): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(request));
    } else {
      console.warn('[NadoWS] Socket is closed. Failed to send message:', request);
    }
  }

  public subscribe(stream: WSStreamFilter): void {
    const key = this.getStreamKey(stream);
    this.activeSubscriptions.set(key, stream);

    if (this.status === 'CONNECTED') {
      let id = Math.floor(Math.random() * 1000000);
      if (stream.type === 'book_depth') id = 1;
      else if (stream.type === 'trade') id = 2;
      else if (stream.type === 'candlestick') id = 3;

      const subscribeMsg: WSClientRequest = {
        method: 'subscribe',
        stream,
        id,
      };
      this.send(subscribeMsg);
      console.log('[NadoWS] Subscribing to:', key, 'with id:', id);
    }
  }

  public unsubscribe(stream: WSStreamFilter): void {
    const key = this.getStreamKey(stream);
    this.activeSubscriptions.delete(key);

    if (this.status === 'CONNECTED') {
      const unsubscribeMsg: WSClientRequest = {
        method: 'unsubscribe',
        stream,
        id: Math.floor(Math.random() * 1000000),
      };
      this.send(unsubscribeMsg);
      console.log('[NadoWS] Unsubscribing from:', key);
    }
  }

  public executeOrder(productId: number, order: NadoOrder, signature: string, reqId?: number): number {
    const id = reqId ?? Math.floor(Math.random() * 1000000);
    const payload = {
      method: 'execute',
      id,
      tx: {
        place_order: {
          product_id: productId,
          order,
          signature,
        },
      },
    };
    if (this.status === 'CONNECTED') {
      this.send(payload as any);
      console.log('[NadoWS] Executing WebSocket order:', id);
    } else {
      console.warn('[NadoWS] Cannot execute WS order. Socket disconnected.');
    }
    return id;
  }

  public authenticate(sender: string, expiration: string | number, signature: string): void {
    this.authPayload = {
      id: 0,
      tx: { sender, expiration },
      signature,
    };

    if (this.status === 'CONNECTED') {
      const authMsg: WSAuthRequest = {
        method: 'authenticate',
        id: 0,
        tx: { sender, expiration },
        signature,
      };
      this.send(authMsg);
      console.log('[NadoWS] Authenticating subaccount session:', sender);
    }
  }

  public clearAuthentication(): void {
    this.authPayload = null;
    // Clear private subscriptions as user is logging out
    for (const [key, stream] of this.activeSubscriptions.entries()) {
      if (
        stream.type === 'fill' ||
        stream.type === 'fills' ||
        stream.type === 'position_change' ||
        stream.type === 'order_update' ||
        stream.type === 'orders' ||
        stream.type === 'subaccount_info'
      ) {
        this.activeSubscriptions.delete(key);
      }
    }
  }

  public addListener(callback: (data: any) => void): void {
    this.messageListeners.add(callback);
  }

  public removeListener(callback: (data: any) => void): void {
    this.messageListeners.delete(callback);
  }

  public addStatusListener(callback: (status: ConnectionStatus) => void): void {
    this.statusListeners.add(callback);
    callback(this.status);
  }

  public removeStatusListener(callback: (status: ConnectionStatus) => void): void {
    this.statusListeners.delete(callback);
  }

  private setStatus(newStatus: ConnectionStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((listener) => listener(newStatus));
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('[NadoWS] Connection established successfully.');
      this.setStatus('CONNECTED');
      this.reconnectAttempts = 0;
      
      this.startHeartbeat();
      this.replaySession();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Suppress logs for ping/pong confirmations
        if (data.status === 'pong' || data.method === 'ping') {
          return;
        }

        this.messageListeners.forEach((listener) => listener(data));
      } catch (err) {
        // Handle potential raw texts or non-JSON frame strings
        console.debug('[NadoWS] Received non-JSON text frame:', event.data);
      }
    };

    this.ws.onerror = (err) => {
      console.error('[NadoWS] WebSocket internal error:', err);
    };

    this.ws.onclose = (event) => {
      console.log(`[NadoWS] Connection closed. Code: ${event.code}, Reason: ${event.reason}`);
      this.handleDisconnect();
    };
  }

  private startHeartbeat(): void {
    if (this.pingIntervalId) clearInterval(this.pingIntervalId);

    // Gateway timeout is 30 seconds. Send ping frame every 30 seconds with id 10.
    this.pingIntervalId = setInterval(() => {
      if (this.status === 'CONNECTED') {
        const pingMsg = { method: 'ping' as const, id: 10 };
        this.send(pingMsg);
      }
    }, 30000);
  }

  private handleDisconnect(): void {
    this.clearTimers();
    this.setStatus('DISCONNECTED');

    if (this.isExplicitlyClosed) return;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      // Exponential backoff: baseDelay * 2^attempts with random jitter
      const exponentialDelay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);
      const jitter = Math.random() * 500; // random jitter up to 500ms
      const delay = Math.min(exponentialDelay + jitter, this.maxReconnectDelay);

      this.reconnectAttempts++;
      console.log(`[NadoWS] Reconnect attempt #${this.reconnectAttempts} in ${(delay / 1000).toFixed(2)}s...`);

      this.reconnectTimeoutId = setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('[NadoWS] Max reconnection attempts reached. Halting automatic reconnects.');
    }
  }

  // Restore authenticated session and public subscriptions upon reconnection
  private replaySession(): void {
    // 1. Re-authenticate first if we have credentials
    if (this.authPayload) {
      const authMsg: WSAuthRequest = {
        method: 'authenticate',
        ...this.authPayload,
      };
      this.send(authMsg);
      console.log('[NadoWS] Restoring session authentication for subaccount:', this.authPayload.tx.sender);
    }

    // 2. Resubscribe to all active channels
    if (this.activeSubscriptions.size > 0) {
      console.log(`[NadoWS] Restoring ${this.activeSubscriptions.size} active subscriptions...`);
      this.activeSubscriptions.forEach((stream) => {
        const subscribeMsg: WSClientRequest = {
          method: 'subscribe',
          stream,
          id: Math.floor(Math.random() * 1000000),
        };
        this.send(subscribeMsg);
      });
    }
  }

  private clearTimers(): void {
    if (this.pingIntervalId) clearInterval(this.pingIntervalId);
    if (this.reconnectTimeoutId) clearTimeout(this.reconnectTimeoutId);
    this.pingIntervalId = null;
    this.reconnectTimeoutId = null;
  }

  private getStreamKey(stream: WSStreamFilter): string {
    const parts: string[] = [stream.type];
    if (stream.product_id !== undefined) parts.push(String(stream.product_id));
    if (stream.granularity !== undefined) parts.push(String(stream.granularity));
    return parts.join(':');
  }
}

/**
 * React Hook that hooks into the singleton Nado WebSocket manager
 */
export function useNadoWebSocket() {
  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const client = useRef<NadoWebSocketClient>(NadoWebSocketClient.getInstance());

  useEffect(() => {
    const handleStatusChange = (newStatus: ConnectionStatus) => {
      setStatus(newStatus);
    };

    const wsClient = client.current;
    wsClient.addStatusListener(handleStatusChange);
    
    // Connect by default
    wsClient.connect();

    return () => {
      wsClient.removeStatusListener(handleStatusChange);
    };
  }, []);

  const subscribe = useCallback((stream: WSStreamFilter) => {
    client.current.subscribe(stream);
  }, []);

  const unsubscribe = useCallback((stream: WSStreamFilter) => {
    client.current.unsubscribe(stream);
  }, []);

  const authenticate = useCallback((sender: string, expiration: string | number, signature: string) => {
    client.current.authenticate(sender, expiration, signature);
  }, []);

  const clearAuthentication = useCallback(() => {
    client.current.clearAuthentication();
  }, []);

  const addListener = useCallback((callback: (data: any) => void) => {
    client.current.addListener(callback);
  }, []);

  const removeListener = useCallback((callback: (data: any) => void) => {
    client.current.removeListener(callback);
  }, []);

  const executeOrder = useCallback((productId: number, order: NadoOrder, signature: string, reqId?: number) => {
    return client.current.executeOrder(productId, order, signature, reqId);
  }, []);

  return {
    status,
    subscribe,
    unsubscribe,
    authenticate,
    clearAuthentication,
    executeOrder,
    addListener,
    removeListener,
    isConnected: status === 'CONNECTED',
    isConnecting: status === 'CONNECTING',
  };
}

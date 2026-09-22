import { NadoEnv, NadoOrder, PlaceOrderPayload, SubaccountState, SubaccountPosition, OHLCVBar, PastFill } from '../types/nado';

// Retrieve Nado Env configuration
export function getNadoEnv(): NadoEnv {
  if (typeof process !== 'undefined' && process.env) {
    const env = process.env.NEXT_PUBLIC_NADO_ENV;
    if (env === 'mainnet' || env === 'prod') {
      return 'mainnet';
    }
  }
  return 'testnet';
}

/**
 * Computes canonical sequencer order/cancellation nonce: (recv_time << 20) + random_jitter
 */
export function getOrderNonce(recvWindowMs: number = 60000): string {
  const time = BigInt(Date.now() + recvWindowMs);
  const randomOffset = BigInt(Math.floor(Math.random() * 1000));
  return ((time << BigInt(20)) + randomOffset).toString();
}

// Retrieve dynamic REST & WebSocket URLs based on unified endpoints
export function getNadoEndpoints() {
  const env = getNadoEnv();
  if (env === 'mainnet') {
    return {
      gateway: 'https://gateway.prod.nado.xyz/v1',
      wsSubscribe: 'wss://gateway.prod.nado.xyz/v1/subscribe',
      wsV1: 'wss://gateway.prod.nado.xyz/v1/ws',
      wsV2: 'wss://gateway.prod.nado.xyz/ws/v2',
      archive: 'https://archive.prod.nado.xyz/v1',
      ws: 'wss://gateway.prod.nado.xyz/v1/subscribe',
    };
  }
  return {
    gateway: 'https://gateway.test.nado.xyz/v1',
    wsSubscribe: 'wss://gateway.test.nado.xyz/v1/subscribe',
    wsV1: 'wss://gateway.test.nado.xyz/v1/ws',
    wsV2: 'wss://gateway.test.nado.xyz/ws/v2',
    archive: 'https://archive.test.nado.xyz/v1',
    ws: 'wss://gateway.test.nado.xyz/v1/subscribe',
  };
}

/**
 * Execute an off-chain sequencer action via POST [GATEWAY_REST_ENDPOINT]/execute
 * Must set Accept-Encoding to include gzip, br, deflate.
 */
export async function executeNadoAction(payload: any): Promise<any> {
  const { gateway } = getNadoEndpoints();
  const url = `${gateway}/execute`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip, br, deflate',
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(`Execute rejected (${response.status}): ${result.message || JSON.stringify(result)}`);
  }
  return result;
}

/**
 * Query off-chain sequencer state via GET/POST [GATEWAY_REST_ENDPOINT]/query
 * For GET, parameters are encoded into URL query strings.
 */
export async function queryNadoState(queryParams: Record<string, any>, method: 'GET' | 'POST' = 'GET'): Promise<any> {
  const { gateway } = getNadoEndpoints();

  let url = `${gateway}/query`;
  const options: RequestInit = {
    method,
    headers: {
      'Accept-Encoding': 'gzip, br, deflate',
    },
  };

  if (method === 'GET') {
    const search = new URLSearchParams();
    Object.entries(queryParams).forEach(([k, v]) => {
      if (typeof v === 'object') {
        search.set(k, JSON.stringify(v));
      } else {
        search.set(k, String(v));
      }
    });
    url = `${url}?${search.toString()}`;
  } else {
    options.headers = {
      ...options.headers,
      'Content-Type': 'application/json',
    };
    options.body = JSON.stringify(queryParams);
  }

  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) {
    throw new Error(`Query failed (${response.status}): ${result.message || JSON.stringify(result)}`);
  }
  return result;
}

/**
 * Fetch current subaccount state including balances, collateral, margin, and open positions.
 */
/**
 * Fetch current subaccount state including balances, collateral, margin, and open positions.
 */
export async function fetchSubaccountState(
  sender: string,
  subaccountName: string = 'default'
): Promise<SubaccountState> {
  try {
    const data = await fetchNadoSubaccountInfo(sender);
    if (data) {
      let collateral = '0';
      if (data.spot_balances && Array.isArray(data.spot_balances)) {
        const usdc = data.spot_balances.find((b: any) => b.product_id === 0);
        if (usdc?.balance?.amount) {
          collateral = (parseFloat(usdc.balance.amount) / 1e18).toString();
        }
      }

      const positions: SubaccountPosition[] = [];
      if (data.perp_balances && Array.isArray(data.perp_balances)) {
        data.perp_balances.forEach((pb: any) => {
          const rawAmt = parseFloat(pb.balance?.amount || '0') / 1e18;
          if (rawAmt !== 0) {
            positions.push({
              product_id: pb.product_id,
              amount: rawAmt.toString(),
              entry_price: (parseFloat(pb.balance?.entry_price || '0') / 1e18).toString(),
              unrealized_pnl: (parseFloat(pb.balance?.unrealized_pnl || '0') / 1e18).toString(),
            });
          }
        });
      }

      return {
        sender,
        subaccount_name: subaccountName,
        collateral,
        free_collateral: collateral,
        margin_usage: '0',
        positions,
      };
    }
  } catch (err) {
    console.warn('[NadoAPI] Failed to fetch subaccount state via query:', err);
  }

  return {
    sender,
    subaccount_name: subaccountName,
    collateral: '0',
    free_collateral: '0',
    margin_usage: '0',
    positions: [],
  };
}

/**
 * Dispatches a signed EIP-712 limit order payload to the off-chain matching engine.
 */
export async function placeOrder(
  productId: number,
  order: NadoOrder,
  signature: string
): Promise<{ order_id: string; status: string; message?: string }> {
  const { gateway } = getNadoEndpoints();
  const url = `${gateway}/execute`;

  const payload: PlaceOrderPayload = {
    place_order: {
      product_id: productId,
      order,
      signature,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip, br, deflate',
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      `Order execution rejected: ${response.status} - ${result.message || JSON.stringify(result)}`
    );
  }

  return result;
}

/**
 * Query historical OHLCV chart bars from Nado Archive API.
 * @param productId Asset product id (e.g. 8 for SOL-PERP, 2 for BTC-PERP, 4 for ETH-PERP)
 * @param resolution Bar resolution ('1m', '5m', '15m', '1h', '1d', etc.)
 * @param limit Maximum number of bars to fetch (default 100)
 */
export async function fetchHistoricalOHLCV(
  productId: number,
  resolution: string = '1h',
  limit: number = 100
): Promise<OHLCVBar[]> {
  const { archive } = getNadoEndpoints();

  const granularityMap: Record<string, number> = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
    '1H': 3600,
    '4h': 14400,
    '4H': 14400,
    '1d': 86400,
    '1D': 86400,
  };

  const granularity = granularityMap[resolution] || 3600;

  try {
    const response = await fetch(archive, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      body: JSON.stringify({
        candlesticks: {
          product_id: productId,
          granularity,
          limit,
        },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.candlesticks && Array.isArray(data.candlesticks)) {
        const sorted = data.candlesticks
          .map((c: any) => ({
            time: parseInt(c.timestamp, 10),
            open: parseFloat(c.open_x18) / 1e18,
            high: parseFloat(c.high_x18) / 1e18,
            low: parseFloat(c.low_x18) / 1e18,
            close: parseFloat(c.close_x18) / 1e18,
            volume: parseFloat(c.volume) / 1e18,
          }))
          .sort((a: OHLCVBar, b: OHLCVBar) => a.time - b.time);

        // Deduplicate strictly by time for chart library stability
        const uniqueBars: OHLCVBar[] = [];
        const seenTimes = new Set<number>();
        for (const bar of sorted) {
          if (!seenTimes.has(bar.time) && bar.close > 0) {
            seenTimes.add(bar.time);
            uniqueBars.push(bar);
          }
        }
        return uniqueBars;
      }
    }
  } catch (err) {
    console.warn('[NadoAPI] Failed to fetch historical candlesticks from archive:', err);
  }

  return [];
}

/**
 * Fetch past fills/executions history for a subaccount from Nado Archive API.
 */
export async function fetchPastFills(
  sender: string,
  limit: number = 50
): Promise<PastFill[]> {
  try {
    const { archive } = getNadoEndpoints();
    const response = await fetch(archive, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      body: JSON.stringify({
        matches: {
          subaccounts: [sender],
          limit,
        },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.matches && Array.isArray(data.matches)) {
        return data.matches.map((m: any) => {
          const rawAmount = parseFloat(m.base_filled || '0') / 1e18;
          const orderPrice = m.order?.priceX18 ? parseFloat(m.order.priceX18) / 1e18 : 0;
          const calcPrice = m.quote_filled && rawAmount !== 0 ? Math.abs(parseFloat(m.quote_filled) / 1e18 / rawAmount) : 0;
          const price = orderPrice || calcPrice;
          const fee = parseFloat(m.fee || '0') / 1e18;
          const timestamp = m.placed_at || (m.submission_idx ? parseInt(m.submission_idx, 10) : Math.floor(Date.now() / 1000));
          const productId = m.pre_balance?.base?.perp?.product_id || 0;

          return {
            productId,
            orderId: m.digest || `match_${m.submission_idx}`,
            fillId: m.digest || `fill_${m.submission_idx}`,
            price,
            amount: Math.abs(rawAmount),
            fee,
            timestamp: typeof timestamp === 'number' ? timestamp : Math.floor(Date.now() / 1000),
            side: rawAmount >= 0 ? ('buy' as const) : ('sell' as const),
          };
        });
      }
    }
  } catch (err) {
    console.warn('[NadoAPI] Failed to fetch past trade fills from archive:', err);
  }

  return [];
}

/**
 * Fetch real public market trade executions from Nado Archive API.
 */
export async function fetchNadoMarketTrades(
  productId: number,
  limit: number = 30
): Promise<Array<{
  price: number;
  amount: number;
  side: 'buy' | 'sell';
  timestamp: number;
  tradeId: string;
}>> {
  try {
    const { archive } = getNadoEndpoints();
    const response = await fetch(archive, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      body: JSON.stringify({
        matches: {
          product_ids: [productId],
          limit,
        },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const txTimestampMap: Record<string, number> = {};
      const txProductMap: Record<string, number> = {};
      if (Array.isArray(data.txs)) {
        data.txs.forEach((tx: any) => {
          if (tx.submission_idx && tx.timestamp) {
            txTimestampMap[tx.submission_idx] = parseInt(tx.timestamp, 10);
          }
          if (tx.submission_idx && tx.tx?.match_orders?.product_id) {
            txProductMap[tx.submission_idx] = tx.tx.match_orders.product_id;
          }
        });
      }

      if (Array.isArray(data.matches)) {
        return data.matches
          .filter((m: any) => m.is_taker && (!txProductMap[m.submission_idx] || txProductMap[m.submission_idx] === productId))
          .map((m: any) => {
            const rawBase = Math.abs(parseFloat(m.base_filled || '0') / 1e18);
            const rawQuote = Math.abs(parseFloat(m.quote_filled || '0') / 1e18);
            const price = rawBase > 0 ? Math.round((rawQuote / rawBase) * 100) / 100 : 0;
            const side = parseFloat(m.base_filled || '0') >= 0 ? ('buy' as const) : ('sell' as const);
            const rawTs = txTimestampMap[m.submission_idx];
            const timestamp = typeof rawTs === 'number' ? rawTs : Math.floor(Date.now() / 1000);
            return {
              price,
              amount: Math.round(rawBase * 100) / 100,
              side,
              timestamp,
              tradeId: m.digest || `match_${m.submission_idx}`,
            };
          })
          .filter((t: any) => t.price > 0 && t.amount > 0);
      }
    }
  } catch (err) {
    console.warn(`[NadoAPI] Failed to fetch market trades for product ${productId}:`, err);
  }
  return [];
}

/**
 * Fetch live orderbook liquidity snapshot from Nado sequencer
 */
export async function fetchNadoLiquidity(productId: number, depth: number = 10): Promise<{ bids: [string, string][]; asks: [string, string][]; timestamp?: string }> {
  const { gateway } = getNadoEndpoints();
  try {
    const res = await fetch(`${gateway}/query?type=market_liquidity&product_id=${productId}&depth=${depth}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn(`[NadoAPI] Failed to fetch liquidity for product ${productId}:`, err);
  }
  return { bids: [], asks: [] };
}

/**
 * Fetch live market best bid and ask from Nado sequencer
 */
export async function fetchNadoMarketPrice(productId: number): Promise<{ bid: number; ask: number; mid: number } | null> {
  const { gateway } = getNadoEndpoints();
  try {
    const res = await fetch(`${gateway}/query?type=market_price&product_id=${productId}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        const bid = parseFloat(json.data.bid_x18) / 1e18;
        const ask = parseFloat(json.data.ask_x18) / 1e18;
        const mid = (bid + ask) / 2;
        return { bid, ask, mid };
      }
    }
  } catch (err) {
    console.warn(`[NadoAPI] Failed to fetch market price for product ${productId}:`, err);
  }
  return null;
}

/**
 * Fetch all products from Nado sequencer including live on-chain Pyth oracle prices
 */
export async function fetchNadoAllProducts(): Promise<{
  spot_products: any[];
  perp_products: Array<{ product_id: number; oracle_price_x18: string; risk: any; state: any }>;
} | null> {
  const { gateway } = getNadoEndpoints();
  try {
    const res = await fetch(`${gateway}/query?type=all_products`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn('[NadoAPI] Failed to fetch all products:', err);
  }
  return null;
}

/**
 * Fetch full subaccount info from Nado sequencer including spot balances and perp positions
 */
export async function fetchNadoSubaccountInfo(subaccountHex: string): Promise<any> {
  const { gateway } = getNadoEndpoints();
  try {
    const res = await fetch(`${gateway}/query?type=subaccount_info&subaccount=${encodeURIComponent(subaccountHex)}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn('[NadoAPI] Failed to fetch subaccount info:', err);
  }
  return null;
}

export interface NadoOpenOrder {
  productId: number;
  sender: string;
  priceX18: string;
  amount: string;
  unfilledAmount: string;
  expiration: string;
  nonce: string;
  digest: string;
  status?: 'open' | 'filled' | 'cancelled' | 'rejected';
  placedAt: number;
}

/**
 * Fetch active open limit orders from Nado Gateway query endpoint
 */
export async function fetchNadoOpenOrders(
  sender: string,
  productId?: number
): Promise<NadoOpenOrder[]> {
  const { gateway } = getNadoEndpoints();
  
  if (productId === undefined) {
    // If no product specified, query the active markets manually since the endpoint requires it
    const activeProducts = [8, 2, 4];
    const results = await Promise.all(activeProducts.map(pid => fetchNadoOpenOrders(sender, pid)));
    return results.flat();
  }

  try {
    const url = `${gateway}/query?type=subaccount_orders&sender=${encodeURIComponent(sender)}&product_id=${productId}`;

    const res = await fetch(url, {
      headers: { 'Accept-Encoding': 'gzip, deflate, br' },
      cache: 'no-store',
    });

    if (res.ok) {
      const json = await res.json();
      if (json.status === 'success' && json.data && Array.isArray(json.data.orders)) {
        return json.data.orders.map((o: any) => ({
          productId: o.product_id,
          sender: o.sender,
          priceX18: o.price_x18,
          amount: o.amount,
          unfilledAmount: o.unfilled_amount,
          expiration: o.expiration,
          nonce: o.nonce,
          digest: o.digest,
          status: o.status,
          placedAt: o.placed_at,
        }));
      }
    }
  } catch (err) {
    console.warn(`[NadoAPI] Failed to fetch open orders for product ${productId}:`, err);
  }
  return [];
}

/**
 * Cancels an open order on Nado off-chain matching engine via EIP-712 Cancellation signature.
 */
export async function cancelNadoOrder(
  productId: number,
  digest: string,
  sender: string,
  signer: any
): Promise<any> {
  const nonce = getOrderNonce();
  const chainId = parseInt(process.env.NEXT_PUBLIC_NADO_CHAIN_ID || '57073', 10);
  const endpointContract = process.env.NEXT_PUBLIC_NADO_ENDPOINT_CONTRACT;

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

  if (endpointContract && endpointContract !== '0x0000000000000000000000000000000000000000') {
    domain.verifyingContract = endpointContract;
  }

  const types = {
    Cancellation: [
      { name: 'sender', type: 'bytes32' },
      { name: 'productIds', type: 'uint32[]' },
      { name: 'digests', type: 'bytes32[]' },
      { name: 'nonce', type: 'uint64' },
    ],
  };

  const value = {
    sender,
    productIds: [productId],
    digests: [digest],
    nonce: BigInt(nonce),
  };

  const signature = await signer.signTypedData(domain, types, value);

  const payload = {
    cancel_orders: {
      tx: {
        sender,
        productIds: [productId],
        digests: [digest],
        nonce,
      },
      signature,
    },
  };

  return await executeNadoAction(payload);
}

/**
 * Request off-chain withdrawal of collateral from Nado Sequencer via EIP-712 signature.
 */
export async function withdrawCollateral(
  productId: number,
  amountX18: string,
  sender: string,
  signer: any
): Promise<any> {
  const nonce = getOrderNonce();
  const chainId = parseInt(process.env.NEXT_PUBLIC_NADO_CHAIN_ID || '57073', 10);
  const endpointContract = process.env.NEXT_PUBLIC_NADO_ENDPOINT_CONTRACT;

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

  if (endpointContract && endpointContract !== '0x0000000000000000000000000000000000000000') {
    domain.verifyingContract = endpointContract;
  }

  const types = {
    WithdrawCollateral: [
      { name: 'sender', type: 'bytes32' },
      { name: 'productId', type: 'uint32' },
      { name: 'amount', type: 'uint128' },
      { name: 'nonce', type: 'uint64' },
    ],
  };

  const value = {
    sender,
    productId,
    amount: BigInt(amountX18),
    nonce: BigInt(nonce),
  };

  const signature = await signer.signTypedData(domain, types, value);

  const payload = {
    withdraw_collateral: {
      tx: {
        sender,
        productId,
        amount: amountX18,
        nonce,
      },
      signature,
    },
  };

  return await executeNadoAction(payload);
}

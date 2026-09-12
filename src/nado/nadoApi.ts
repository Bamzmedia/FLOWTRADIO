import { NadoEnv, NadoOrder, PlaceOrderPayload, SubaccountState, SubaccountPosition, OHLCVBar, PastFill } from '../types/nado';

// Retrieve Nado Env configuration
export function getNadoEnv(): NadoEnv {
  if (typeof process !== 'undefined' && process.env) {
    const env = process.env.NEXT_PUBLIC_NADO_ENV;
    if (env === 'testnet') {
      return 'testnet';
    }
  }
  return 'mainnet';
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
 * Query historical OHLCV chart bars for visual charts (like Lightweight Charts).
 * @param productId Asset product id (e.g. 4 for ETH-PERP)
 * @param resolution Bar resolution ('1m', '5m', '15m', '1h', '1d', etc.)
 * @param from Unix timestamp (seconds)
 * @param to Unix timestamp (seconds)
 */
export async function fetchHistoricalOHLCV(
  productId: number,
  resolution: string,
  from: number,
  to: number
): Promise<OHLCVBar[]> {
  const { archive } = getNadoEndpoints();
  const url = `${archive}/ohlcv?product_id=${productId}&resolution=${encodeURIComponent(
    resolution
  )}&from=${from}&to=${to}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch historical OHLCV: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch past fills/executions history for a subaccount.
 */
export async function fetchPastFills(
  sender: string,
  subaccountName: string = 'default'
): Promise<PastFill[]> {
  try {
    const { archive } = getNadoEndpoints();
    const url = `${archive}/fills?sender=${encodeURIComponent(sender)}&subaccount_name=${encodeURIComponent(subaccountName)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('[NadoAPI] Failed to fetch past trade fills:', err);
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


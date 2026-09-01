import { NadoEnv, NadoOrder, PlaceOrderPayload, SubaccountState, OHLCVBar, PastFill } from '../types/nado';

// Retrieve Nado Env configuration
export function getNadoEnv(): NadoEnv {
  if (typeof process !== 'undefined' && process.env) {
    const env = process.env.NEXT_PUBLIC_NADO_ENV;
    if (env === 'mainnet') {
      return 'mainnet';
    }
  }
  return 'testnet';
}

// Retrieve dynamic REST & WebSocket URLs based on unified endpoints
export function getNadoEndpoints() {
  const env = getNadoEnv();
  if (env === 'mainnet') {
    return {
      gateway: 'https://api.prod.nado.xyz/gateway/v1',
      wsV1: 'wss://api.prod.nado.xyz/gateway/v1/ws',
      wsV2: 'wss://api.prod.nado.xyz/gateway/ws/v2',
      archive: 'https://archive.prod.nado.xyz/v1',
      ws: 'wss://api.prod.nado.xyz/gateway/v1/ws',
    };
  }
  return {
    gateway: 'https://api.test.nado.xyz/gateway/v1',
    wsV1: 'wss://api.test.nado.xyz/gateway/v1/ws',
    wsV2: 'wss://api.test.nado.xyz/gateway/ws/v2',
    archive: 'https://archive.test.nado.xyz/v1',
    ws: 'wss://api.test.nado.xyz/gateway/v1/ws',
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
export async function fetchSubaccountState(
  sender: string,
  subaccountName: string = 'default'
): Promise<SubaccountState> {
  const { gateway } = getNadoEndpoints();
  const url = `${gateway}/subaccount?sender=${encodeURIComponent(sender)}&subaccount_name=${encodeURIComponent(subaccountName)}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch subaccount state: ${response.status} ${response.statusText}`);
  }

  return response.json();
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
  const { archive } = getNadoEndpoints();
  const url = `${archive}/fills?sender=${encodeURIComponent(sender)}&subaccount_name=${encodeURIComponent(subaccountName)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch past trade fills: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

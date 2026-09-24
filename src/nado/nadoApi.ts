import { NadoEnv, NadoOrder, PlaceOrderPayload, SubaccountState, SubaccountPosition, OHLCVBar, PastFill, NadoSpotAsset, NadoPerpPosition, NadoUserPortfolio } from '../types/nado';

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
 * Browser-safe 32-byte subaccount hex formatter (address + 12-byte padded subaccount name)
 * Pure JS without Node Buffer dependency so it never throws ReferenceError in browser components.
 */
export function getSubaccountHex(address: string, subaccountName: string = 'default'): string {
  const cleanAddr = address.replace(/^0x/, '').toLowerCase().padStart(40, '0').slice(0, 40);
  let nameHex = '';
  for (let i = 0; i < 12; i++) {
    if (i < subaccountName.length) {
      nameHex += subaccountName.charCodeAt(i).toString(16).padStart(2, '0');
    } else {
      nameHex += '00';
    }
  }
  return '0x' + cleanAddr + nameHex;
}

/**
 * Parses raw Nado subaccount response into scaled numerical balances
 */
export function parseSubaccountBalances(data: any): {
  totalCollateral: number;
  freeCollateral: number;
  marginUsage: number;
  spotBalances: Record<number, number>;
} {
  if (!data) {
    return { totalCollateral: 0, freeCollateral: 0, marginUsage: 0, spotBalances: {} };
  }

  let totalCollateral = 0;
  let freeCollateral = 0;
  let marginUsage = 0;
  const spotBalances: Record<number, number> = {};
  let spotSumUsd = 0;

  // 1. Spot balances (1e18 normalized)
  if (data.spot_balances && Array.isArray(data.spot_balances)) {
    data.spot_balances.forEach((sb: any) => {
      if (sb && typeof sb.product_id === 'number') {
        const rawAmt = sb.balance?.amount ? parseFloat(sb.balance.amount) / 1e18 : 0;
        spotBalances[sb.product_id] = rawAmt;
        if (rawAmt > 0) {
          if (sb.product_id === 0 || sb.product_id === 5 || sb.product_id === 11) {
            spotSumUsd += rawAmt;
          } else if (sb.product_id === 1) { // KBTC (~$84,000)
            spotSumUsd += rawAmt * 84000;
          } else if (sb.product_id === 3) { // WETH (~$2,700)
            spotSumUsd += rawAmt * 2700;
          } else {
            spotSumUsd += rawAmt;
          }
        }
      }
    });
  }

  // 2. Healths array:
  // index 0: initial health (free collateral / liabilities = margin usage)
  // index 1: maintenance health
  // index 2: unweighted health (total collateral assets / account equity)
  if (data.healths && Array.isArray(data.healths) && data.healths.length > 0) {
    const initialHealth = parseFloat(data.healths[0]?.health || '0') / 1e18;
    const initialLiabilities = parseFloat(data.healths[0]?.liabilities || '0') / 1e18;
    freeCollateral = Math.max(0, initialHealth);
    marginUsage = Math.max(0, initialLiabilities);

    const unweightedHealth = data.healths[2]?.health ? parseFloat(data.healths[2].health) / 1e18 : 0;
    const unweightedAssets = data.healths[2]?.assets ? parseFloat(data.healths[2].assets) / 1e18 : 0;

    totalCollateral = Math.max(
      0,
      unweightedHealth,
      unweightedAssets,
      freeCollateral + marginUsage,
      spotSumUsd
    );
  } else if (spotSumUsd > 0) {
    totalCollateral = spotSumUsd;
    freeCollateral = spotSumUsd;
  }

  // Fallback: If totalCollateral is 0, check quote spot balances (0: USD₮0/USDC, 5: USDC)
  const quoteSpotTotal = (spotBalances[0] || 0) + (spotBalances[5] || 0);
  if (totalCollateral === 0 && quoteSpotTotal > 0) {
    totalCollateral = quoteSpotTotal;
    freeCollateral = quoteSpotTotal;
  }

  return {
    totalCollateral,
    freeCollateral,
    marginUsage,
    spotBalances,
  };
}

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
      const parsed = parseSubaccountBalances(data);

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
        collateral: parsed.totalCollateral.toString(),
        free_collateral: parsed.freeCollateral.toString(),
        margin_usage: parsed.marginUsage.toString(),
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
 * With automatic cross-environment fallback (mainnet + testnet) so balance is NEVER missed
 */
export async function fetchNadoSubaccountInfo(subaccountHex: string): Promise<any> {
  const { gateway } = getNadoEndpoints();
  try {
    const res = await fetch(`${gateway}/query?type=subaccount_info&subaccount=${encodeURIComponent(subaccountHex)}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        // If data has non-zero spot balance or healths, return immediately
        const parsed = parseSubaccountBalances(json.data);
        if (parsed.totalCollateral > 0 || parsed.freeCollateral > 0) {
          return json.data;
        }
        // If primary has 0, check fallback gateway (testnet vs mainnet)
        const fallbackGateway = gateway.includes('prod') 
          ? 'https://gateway.test.nado.xyz/v1' 
          : 'https://gateway.prod.nado.xyz/v1';
        try {
          const fbRes = await fetch(`${fallbackGateway}/query?type=subaccount_info&subaccount=${encodeURIComponent(subaccountHex)}`, { cache: 'no-store' });
          if (fbRes.ok) {
            const fbJson = await fbRes.json();
            if (fbJson.status === 'success' && fbJson.data) {
              const fbParsed = parseSubaccountBalances(fbJson.data);
              if (fbParsed.totalCollateral > 0 || fbParsed.freeCollateral > 0) {
                return fbJson.data;
              }
            }
          }
        } catch {}
        return json.data;
      }
    }
  } catch (err) {
    console.warn('[NadoAPI] Failed to fetch subaccount info from primary gateway, trying fallback:', err);
    try {
      const fallbackGateway = gateway.includes('prod') 
        ? 'https://gateway.test.nado.xyz/v1' 
        : 'https://gateway.prod.nado.xyz/v1';
      const fbRes = await fetch(`${fallbackGateway}/query?type=subaccount_info&subaccount=${encodeURIComponent(subaccountHex)}`, { cache: 'no-store' });
      if (fbRes.ok) {
        const fbJson = await fbRes.json();
        if (fbJson.status === 'success' && fbJson.data) {
          return fbJson.data;
        }
      }
    } catch {}
  }
  return null;
}

/**
 * Fetch all subaccount hex identifiers associated with an EVM address from Nado Archive
 */
export async function fetchUserSubaccounts(address: string): Promise<string[]> {
  const defaultSub = getSubaccountHex(address, 'default');
  const uniqueSubs = new Set<string>([defaultSub]);

  try {
    const cleanAddr = address.toLowerCase();
    const { archive } = getNadoEndpoints();
    const fallbackArchive = archive.includes('prod') 
      ? 'https://archive.test.nado.xyz/v1' 
      : 'https://archive.prod.nado.xyz/v1';

    const [primaryRes, fbRes] = await Promise.allSettled([
      fetch(archive, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip, br, deflate' },
        body: JSON.stringify({ subaccounts: { address: cleanAddr } }),
      }),
      fetch(fallbackArchive, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip, br, deflate' },
        body: JSON.stringify({ subaccounts: { address: cleanAddr } }),
      }),
    ]);

    const addFromRes = async (res: PromiseSettledResult<Response>) => {
      if (res.status === 'fulfilled' && res.value.ok) {
        const json = await res.value.json();
        if (Array.isArray(json?.subaccounts)) {
          json.subaccounts.forEach((s: any) => {
            if (s?.subaccount && typeof s.subaccount === 'string') {
              uniqueSubs.add(s.subaccount);
            }
          });
        }
      }
    };

    await Promise.all([addFromRes(primaryRes), addFromRes(fbRes)]);
  } catch (err) {
    console.warn('[NadoAPI] Failed to fetch user subaccounts from archive:', err);
  }

  return Array.from(uniqueSubs);
}

export const NADO_SPOT_METADATA: Record<number, { symbol: string; name: string; defaultPrice: number }> = {
  0: { symbol: 'USDC', name: 'USD Coin', defaultPrice: 1.0 },
  1: { symbol: 'KBTC', name: 'Kernel Bitcoin', defaultPrice: 84000.0 },
  3: { symbol: 'WETH', name: 'Wrapped Ether', defaultPrice: 2700.0 },
  5: { symbol: 'USDT', name: 'Tether USD', defaultPrice: 1.0 },
  11: { symbol: 'USDE', name: 'Ethena USDe', defaultPrice: 1.0 },
  115: { symbol: 'wQQQx', name: 'Invesco QQQ Trust', defaultPrice: 500.0 },
  117: { symbol: 'wSPYx', name: 'SPDR S&P 500 ETF', defaultPrice: 570.0 },
  143: { symbol: 'wAAPLx', name: 'Apple Inc.', defaultPrice: 230.0 },
  145: { symbol: 'wAMZNx', name: 'Amazon.com Inc.', defaultPrice: 190.0 },
  147: { symbol: 'wGOOGLx', name: 'Alphabet Inc.', defaultPrice: 160.0 },
  149: { symbol: 'wMETAx', name: 'Meta Platforms Inc.', defaultPrice: 580.0 },
  151: { symbol: 'wMSFTx', name: 'Microsoft Corp.', defaultPrice: 430.0 },
  153: { symbol: 'wNVDAx', name: 'Nvidia Corp.', defaultPrice: 120.0 },
  155: { symbol: 'wTSLAx', name: 'Tesla Inc.', defaultPrice: 250.0 },
  159: { symbol: 'XAUT0', name: 'Tether Gold', defaultPrice: 2650.0 },
};

export const NADO_PERP_METADATA: Record<number, { symbol: string; defaultPrice: number }> = {
  2: { symbol: 'BTC-PERP', defaultPrice: 86400.0 },
  4: { symbol: 'ETH-PERP', defaultPrice: 2775.0 },
  8: { symbol: 'SOL-PERP', defaultPrice: 119.0 },
  10: { symbol: 'SUI-PERP', defaultPrice: 2.1 },
  14: { symbol: 'DOGE-PERP', defaultPrice: 0.18 },
  16: { symbol: 'XRP-PERP', defaultPrice: 1.45 },
  18: { symbol: 'AVAX-PERP', defaultPrice: 28.5 },
  20: { symbol: 'LINK-PERP', defaultPrice: 14.5 },
  22: { symbol: 'BNB-PERP', defaultPrice: 620.0 },
  24: { symbol: 'NEAR-PERP', defaultPrice: 5.2 },
  26: { symbol: 'AAVE-PERP', defaultPrice: 175.0 },
  30: { symbol: 'PEPE-PERP', defaultPrice: 0.00001 },
  32: { symbol: 'TIA-PERP', defaultPrice: 5.8 },
  38: { symbol: 'SHIB-PERP', defaultPrice: 0.00002 },
  46: { symbol: 'TAO-PERP', defaultPrice: 480.0 },
  48: { symbol: 'FET-PERP', defaultPrice: 1.3 },
  50: { symbol: 'WIF-PERP', defaultPrice: 2.2 },
  52: { symbol: 'RENDER-PERP', defaultPrice: 6.2 },
  54: { symbol: 'INJ-PERP', defaultPrice: 19.5 },
  56: { symbol: 'BONK-PERP', defaultPrice: 0.00002 },
  58: { symbol: 'FTM-PERP', defaultPrice: 0.7 },
  64: { symbol: 'ARB-PERP', defaultPrice: 0.8 },
  68: { symbol: 'OP-PERP', defaultPrice: 1.6 },
  72: { symbol: 'SEI-PERP', defaultPrice: 0.4 },
  74: { symbol: 'APT-PERP', defaultPrice: 8.5 },
  76: { symbol: 'STX-PERP', defaultPrice: 1.8 },
  78: { symbol: 'RUNE-PERP', defaultPrice: 5.0 },
  80: { symbol: 'JUP-PERP', defaultPrice: 0.9 },
  86: { symbol: 'ONDO-PERP', defaultPrice: 0.75 },
  122: { symbol: 'POPCAT-PERP', defaultPrice: 1.2 },
};

/**
 * Discovers and queries all user subaccounts on Nado, compiling full portfolio assets
 */
export async function fetchUserNadoPortfolio(address: string): Promise<NadoUserPortfolio> {
  const subaccounts = await fetchUserSubaccounts(address);
  const defaultSub = getSubaccountHex(address, 'default');
  
  let bestSubaccountHex = defaultSub;
  let bestSubaccountName = 'default';
  let bestTotalCollateral = 0;
  let bestFreeCollateral = 0;
  let bestMarginUsage = 0;
  let allSpotAssets: NadoSpotAsset[] = [];
  let allPerpPositions: NadoPerpPosition[] = [];

  const subResults = await Promise.allSettled(
    subaccounts.map(subHex => fetchNadoSubaccountInfo(subHex).then(data => ({ subHex, data })))
  );

  for (const res of subResults) {
    if (res.status === 'fulfilled' && res.value?.data) {
      const { subHex, data } = res.value;
      const parsed = parseSubaccountBalances(data);

      let subName = 'default';
      try {
        if (subHex.length === 66) {
          const hexName = subHex.slice(42);
          const chars: string[] = [];
          for (let i = 0; i < hexName.length; i += 2) {
            const byte = parseInt(hexName.substring(i, i + 2), 16);
            if (byte === 0) break;
            chars.push(String.fromCharCode(byte));
          }
          if (chars.length > 0) subName = chars.join('');
        }
      } catch {}

      const spots: NadoSpotAsset[] = [];
      if (data.spot_balances && Array.isArray(data.spot_balances)) {
        data.spot_balances.forEach((sb: any) => {
          const rawAmt = sb.balance?.amount ? parseFloat(sb.balance.amount) / 1e18 : 0;
          if (Math.abs(rawAmt) > 0.0001) {
            const meta = NADO_SPOT_METADATA[sb.product_id] || {
              symbol: `TOKEN-${sb.product_id}`,
              name: `Product ${sb.product_id}`,
              defaultPrice: 1.0,
            };
            const price = meta.defaultPrice;
            spots.push({
              productId: sb.product_id,
              symbol: meta.symbol,
              name: meta.name,
              amount: rawAmt,
              price,
              valueUsd: rawAmt * price,
            });
          }
        });
      }

      const perps: NadoPerpPosition[] = [];
      if (data.perp_balances && Array.isArray(data.perp_balances)) {
        data.perp_balances.forEach((pb: any) => {
          const rawAmt = pb.balance?.amount ? parseFloat(pb.balance.amount) / 1e18 : 0;
          if (Math.abs(rawAmt) > 0.0001) {
            const meta = NADO_PERP_METADATA[pb.product_id] || {
              symbol: `PERP-${pb.product_id}`,
              defaultPrice: 100.0,
            };
            const entryPrice = pb.balance?.entry_price ? parseFloat(pb.balance.entry_price) / 1e18 : meta.defaultPrice;
            const markPrice = meta.defaultPrice;
            const notional = Math.abs(rawAmt) * markPrice;
            const pnl = rawAmt > 0 ? (markPrice - entryPrice) * rawAmt : (entryPrice - markPrice) * Math.abs(rawAmt);

            perps.push({
              productId: pb.product_id,
              symbol: meta.symbol,
              side: rawAmt > 0 ? 'long' : 'short',
              amount: Math.abs(rawAmt),
              entryPrice,
              markPrice,
              valueUsd: notional,
              unrealizedPnl: pnl,
            });
          }
        });
      }

      // Check if this subaccount has assets or is the active one
      if (parsed.totalCollateral > bestTotalCollateral || (bestTotalCollateral === 0 && spots.length > 0)) {
        bestTotalCollateral = parsed.totalCollateral;
        bestFreeCollateral = parsed.freeCollateral;
        bestMarginUsage = parsed.marginUsage;
        bestSubaccountHex = subHex;
        bestSubaccountName = subName;
        allSpotAssets = spots;
        allPerpPositions = perps;
      } else if (subHex === defaultSub && bestTotalCollateral === 0) {
        bestTotalCollateral = parsed.totalCollateral;
        bestFreeCollateral = parsed.freeCollateral;
        bestMarginUsage = parsed.marginUsage;
        bestSubaccountHex = subHex;
        bestSubaccountName = subName;
        allSpotAssets = spots;
        allPerpPositions = perps;
      }
    }
  }

  return {
    subaccountHex: bestSubaccountHex,
    subaccountName: bestSubaccountName,
    allSubaccounts: subaccounts,
    totalCollateral: bestTotalCollateral,
    freeCollateral: bestFreeCollateral,
    marginUsage: bestMarginUsage,
    spotAssets: allSpotAssets,
    perpPositions: allPerpPositions,
  };
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
  const senderBytes32 = sender.length === 66 && sender.startsWith('0x')
    ? sender
    : getSubaccountHex(sender, 'default');

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
    sender: senderBytes32,
    productId,
    amount: BigInt(amountX18),
    nonce: BigInt(nonce),
  };

  const signature = await signer.signTypedData(domain, types, value);

  const payload = {
    withdraw_collateral: {
      tx: {
        sender: senderBytes32,
        productId,
        amount: amountX18,
        nonce,
      },
      signature,
    },
  };

  return await executeNadoAction(payload);
}

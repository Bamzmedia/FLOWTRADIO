import { NextResponse } from 'next/server';
import { getNadoEndpoints } from '@/nado/nadoApi';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get('symbol') || 'SOLUSDT').toUpperCase();
  const resolution = (searchParams.get('resolution') || '1h').toLowerCase();

  // Price & 24h Ticker Fallback Chain
  let price = 0;
  let change24h = '+0.00';
  let high24h = 0;
  let low24h = 0;
  let volume24h = '0';
  let klines: any[] = [];

  // 0. Primary: Fetch Live Price and 24h stats from Nado Gateway & Archive
  try {
    const productMap: Record<string, number> = {
      'SOLUSDT': 8, 'SOL-PERP': 8, 'SOL': 8,
      'BTCUSDT': 2, 'BTC-PERP': 2, 'BTC': 2,
      'ETHUSDT': 4, 'ETH-PERP': 4, 'ETH': 4,
    };
    const pId = productMap[symbol] || 8;
    const { gateway, archive } = getNadoEndpoints();

    const [nadoRes, ohlcvRes] = await Promise.allSettled([
      fetch(`${gateway}/query?type=market_price&product_id=${pId}`, {
        headers: { 'Accept-Encoding': 'gzip, deflate, br' },
        cache: 'no-store',
      }),
      fetch(archive, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
        },
        body: JSON.stringify({
          candlesticks: { product_id: pId, granularity: 3600, limit: 24 },
        }),
      }),
    ]);

    if (nadoRes.status === 'fulfilled' && nadoRes.value.ok) {
      const nData = await nadoRes.value.json();
      if (nData.status === 'success' && nData.data) {
        const bid = parseFloat(nData.data.bid_x18) / 1e18;
        const ask = parseFloat(nData.data.ask_x18) / 1e18;
        if (bid > 0 && ask > 0) {
          price = Math.round(((bid + ask) / 2) * 100) / 100;
        }
      }
    }

    if (ohlcvRes.status === 'fulfilled' && ohlcvRes.value.ok) {
      const cData = await ohlcvRes.value.json();
      if (Array.isArray(cData.candlesticks) && cData.candlesticks.length > 0) {
        const bars = cData.candlesticks.map((c: any) => ({
          time: parseInt(c.timestamp, 10),
          open: parseFloat(c.open_x18) / 1e18,
          high: parseFloat(c.high_x18) / 1e18,
          low: parseFloat(c.low_x18) / 1e18,
          close: parseFloat(c.close_x18) / 1e18,
          volume: parseFloat(c.volume) / 1e18,
        }));
        klines = bars;
        if (price === 0 && bars.length > 0) {
          price = bars[bars.length - 1].close;
        }
        const highs = bars.map((b: any) => b.high);
        const lows = bars.map((b: any) => b.low);
        const totalVol = bars.reduce((acc: number, b: any) => acc + (b.volume || 0), 0);
        const first = bars[0].open || bars[0].close;
        const last = bars[bars.length - 1].close;
        const pct = first > 0 ? ((last - first) / first) * 100 : 0;

        high24h = Math.round(Math.max(...highs) * 100) / 100;
        low24h = Math.round(Math.min(...lows) * 100) / 100;
        change24h = (pct >= 0 ? '+' : '') + pct.toFixed(2);
        const assetSymbol = symbol.replace('-PERP', '').replace('USDT', '');
        volume24h = totalVol > 0 ? `${totalVol.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${assetSymbol}` : `0 ${assetSymbol}`;
      }
    }
  } catch (nadoErr) {
    console.warn('[TickerAPI] Nado query failed:', nadoErr);
  }



  // Default fallback if all APIs are offline
  if (price === 0) {
    const defaults: Record<string, number> = { SOLUSDT: 148.5, BTCUSDT: 86500.0, ETHUSDT: 2680.0 };
    price = defaults[symbol] || 100.0;
    high24h = price * 1.03;
    low24h = price * 0.97;
    volume24h = '45,210,000';
  }

  return NextResponse.json({
    symbol,
    price,
    change24h,
    high24h,
    low24h,
    volume24h,
    klines,
    timestamp: Date.now(),
  });
}

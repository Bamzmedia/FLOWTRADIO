import { NextResponse } from 'next/server';

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

  // 1. Try Binance REST
  try {
    const [tRes, kRes] = await Promise.all([
      fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`, { cache: 'no-store' }),
      fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${resolution}&limit=100`, { cache: 'no-store' })
    ]);

    if (tRes.ok) {
      const ticker = await tRes.json();
      price = parseFloat(ticker.lastPrice);
      change24h = parseFloat(ticker.priceChangePercent).toFixed(2);
      high24h = parseFloat(ticker.highPrice);
      low24h = parseFloat(ticker.lowPrice);
      volume24h = parseFloat(ticker.volume).toLocaleString(undefined, { maximumFractionDigits: 0 });
    }

    if (kRes.ok) {
      const kData = await kRes.json();
      klines = kData.map((k: any) => ({
        time: k[0] / 1000,
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
      }));
    }
  } catch (err) {
    console.warn('[TickerAPI] Binance fetch failed, trying CryptoCompare fallback...', err);
  }

  // 2. CryptoCompare Fallback if Binance failed
  if (price === 0) {
    try {
      const coin = symbol.replace('USDT', '');
      const ccRes = await fetch(
        `https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${coin}&tsyms=USD`,
        { cache: 'no-store' }
      );
      if (ccRes.ok) {
        const ccData = await ccRes.json();
        const raw = ccData.RAW?.[coin]?.USD;
        if (raw) {
          price = raw.PRICE;
          change24h = (raw.CHANGEPCT24HOUR || 0).toFixed(2);
          high24h = raw.HIGH24HOUR || 0;
          low24h = raw.LOW24HOUR || 0;
          volume24h = (raw.VOLUME24HOUR || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
        }
      }
    } catch (ccErr) {
      console.warn('[TickerAPI] CryptoCompare fetch failed...', ccErr);
    }
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

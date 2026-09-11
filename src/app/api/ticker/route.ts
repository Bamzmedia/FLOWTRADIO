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

  // 3. Pyth Hermes Oracle Fallback if other sources are offline
  if (price === 0) {
    try {
      const PYTH_IDS: Record<string, string> = {
        BTCUSDT: '0xe62df6e88821a32be663b5823081fdda3a0d2d17964b00e6323a43368a4a4a44',
        ETHUSDT: '0xff61491a931112ddf1bdc1c25e835787f1f1a41b93ca8218079638d1a5747074',
        SOLUSDT: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
      };
      const pythId = PYTH_IDS[symbol];
      if (pythId) {
        const pRes = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=${pythId}`, { cache: 'no-store' });
        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData.parsed?.[0]?.price) {
            const raw = BigInt(pData.parsed[0].price.price);
            const expo = pData.parsed[0].price.expo;
            const p = Number(raw) * Math.pow(10, expo);
            if (p > 0) {
              price = p;
              high24h = p;
              low24h = p;
            }
          }
        }
      }
    } catch (pythErr) {
      console.warn('[TickerAPI] Pyth Hermes fallback failed...', pythErr);
    }
  }

  if (price === 0) {
    return NextResponse.json(
      { error: 'Live price feed unavailable for requested symbol', symbol },
      { status: 503 }
    );
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

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CANONICAL_MARKETS = [
  { id: 'btc', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'eth', symbol: 'ETH', name: 'Ethereum' },
  { id: 'sol', symbol: 'SOL', name: 'Solana' },
  { id: 'avax', symbol: 'AVAX', name: 'Avalanche' },
  { id: 'link', symbol: 'LINK', name: 'Chainlink' },
  { id: 'arb', symbol: 'ARB', name: 'Arbitrum' },
  { id: 'doge', symbol: 'DOGE', name: 'Dogecoin' },
];

export async function GET() {
  try {
    const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "AVAXUSDT", "LINKUSDT", "ARBUSDT", "DOGEUSDT"];

    // 1. Fetch 24hr spot ticker metrics (price, 24h change, volume, trade count)
    const tickerPromise = fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(symbols)}`,
      { next: { revalidate: 10 } }
    ).then((r) => (r.ok ? r.json() : []));

    // 2. Fetch live perpetual funding rates from Binance Futures
    const premiumIndexPromise = fetch(
      'https://fapi.binance.com/fapi/v1/premiumIndex',
      { next: { revalidate: 10 } }
    ).then((r) => (r.ok ? r.json() : []));

    // 3. Fetch live open interest for each perpetual pair
    const oiPromises = Promise.allSettled(
      symbols.map(async (sym) => {
        try {
          const res = await fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${sym}`, {
            next: { revalidate: 15 },
          });
          if (res.ok) {
            const data = await res.json();
            return { symbol: sym, openInterest: parseFloat(data.openInterest || '0') };
          }
        } catch {}
        return { symbol: sym, openInterest: 0 };
      })
    );

    const [tickerData, premiumData, oiResults] = await Promise.all([
      tickerPromise,
      premiumIndexPromise,
      oiPromises,
    ]);

    const marketMap = new Map();
    if (Array.isArray(tickerData)) {
      tickerData.forEach((item: any) => marketMap.set(item.symbol, item));
    }

    const premiumMap = new Map();
    if (Array.isArray(premiumData)) {
      premiumData.forEach((item: any) => premiumMap.set(item.symbol, item));
    }

    const oiMap = new Map();
    if (Array.isArray(oiResults)) {
      oiResults.forEach((res) => {
        if (res.status === 'fulfilled' && res.value) {
          oiMap.set(res.value.symbol, res.value.openInterest);
        }
      });
    }

    let totalTradesCount = 0;

    const updatedMarkets = CANONICAL_MARKETS.map((market) => {
      const binanceSymbol = `${market.symbol}USDT`;
      const ticker = marketMap.get(binanceSymbol);
      const premium = premiumMap.get(binanceSymbol);
      const rawOi = oiMap.get(binanceSymbol) || 0;

      const price = ticker ? parseFloat(ticker.lastPrice) : 0;
      const change24h = ticker ? parseFloat(ticker.priceChangePercent) : 0;
      const volume24h = ticker ? parseFloat(ticker.quoteVolume) : 0;
      const tradesCount = ticker ? parseInt(ticker.count || '0', 10) : 0;
      totalTradesCount += tradesCount;

      // Real 8h perpetual funding rate in percentage (e.g. 0.0001 -> 0.0100%)
      const fundingRate = premium && premium.lastFundingRate ? parseFloat(premium.lastFundingRate) * 100 : 0;

      // Real USD Open Interest = (contract open interest * current price)
      const oiUsd = rawOi * (price > 0 ? price : 1);

      return {
        id: market.id,
        symbol: market.symbol,
        name: market.name,
        price,
        change24h,
        volume24h,
        fundingRate,
        oi: oiUsd,
        tradesCount,
      };
    });

    return NextResponse.json({
      data: updatedMarkets,
      meta: {
        totalTradesCount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.warn("Binance API fetch failed or blocked by DNS, attempting CoinGecko fallback...", error);
    try {
      const cgMap: Record<string, string> = {
        btc: 'bitcoin',
        eth: 'ethereum',
        sol: 'solana',
        avax: 'avalanche-2',
        link: 'chainlink',
        arb: 'arbitrum',
        doge: 'dogecoin',
      };
      const ids = Object.values(cgMap).join(',');
      const cgRes = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true`,
        { next: { revalidate: 15 } }
      );
      if (cgRes.ok) {
        const cgData = await cgRes.json();
        const fallbackMarkets = CANONICAL_MARKETS.map((m) => {
          const coinId = cgMap[m.id];
          const info = coinId ? cgData[coinId] : null;
          return {
            id: m.id,
            symbol: m.symbol,
            name: m.name,
            price: info?.usd || 0,
            change24h: info?.usd_24h_change || 0,
            volume24h: info?.usd_24h_vol || 0,
            fundingRate: 0.01,
            oi: (info?.usd || 0) * 1000,
            tradesCount: 15000,
          };
        });
        return NextResponse.json({
          data: fallbackMarkets,
          meta: {
            totalTradesCount: fallbackMarkets.reduce((acc, m) => acc + m.tradesCount, 0),
            timestamp: new Date().toISOString(),
            source: 'coingecko',
          },
        });
      }
    } catch (cgErr) {
      console.error("CoinGecko fallback failed:", cgErr);
    }

    return NextResponse.json(
      {
        error: 'Live market feeds currently unavailable',
        data: CANONICAL_MARKETS.map((m) => ({
          ...m,
          price: 0,
          change24h: 0,
          volume24h: 0,
          fundingRate: 0,
          oi: 0,
          tradesCount: 0,
        })),
        isFallback: true,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

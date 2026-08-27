import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MOCK_MARKETS = [
  { id: 'nado', symbol: 'NADO', name: 'Nado Token', price: 2.45, change24h: 12.5, volume24h: 15400000, fundingRate: 0.01, oi: 5200000 },
  { id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 80450.00, change24h: 2.4, volume24h: 845000000, fundingRate: 0.005, oi: 154000000 },
  { id: 'eth', symbol: 'ETH', name: 'Ethereum', price: 2620.50, change24h: -1.2, volume24h: 420000000, fundingRate: -0.002, oi: 89000000 },
  { id: 'sol', symbol: 'SOL', name: 'Solana', price: 148.90, change24h: 8.5, volume24h: 156000000, fundingRate: 0.015, oi: 45000000 },
  { id: 'avax', symbol: 'AVAX', name: 'Avalanche', price: 35.40, change24h: 1.5, volume24h: 45000000, fundingRate: 0.008, oi: 12000000 },
  { id: 'link', symbol: 'LINK', name: 'Chainlink', price: 18.20, change24h: -4.2, volume24h: 32000000, fundingRate: -0.01, oi: 8500000 },
  { id: 'arb', symbol: 'ARB', name: 'Arbitrum', price: 1.15, change24h: 4.2, volume24h: 28000000, fundingRate: 0.005, oi: 6200000 },
  { id: 'doge', symbol: 'DOGE', name: 'Dogecoin', price: 0.14, change24h: -8.5, volume24h: 85000000, fundingRate: -0.02, oi: 18000000 },
];

export async function GET() {
  try {
    const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "AVAXUSDT", "LINKUSDT", "ARBUSDT", "DOGEUSDT"];
    const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(symbols)}`, {
      next: { revalidate: 10 } // Cache REST request for 10 seconds to avoid HTTP 429
    });
    
    if (response.ok) {
      const data = await response.json();
      
      const marketMap = new Map();
      data.forEach((item: any) => {
        marketMap.set(item.symbol, item);
      });
      
      const updatedMarkets = MOCK_MARKETS.map(market => {
        if (market.symbol === 'NADO') return market; // NADO remains static
        
        const binanceSymbol = `${market.symbol}USDT`;
        const ticker = marketMap.get(binanceSymbol);
        
        if (ticker) {
          return {
            ...market,
            price: parseFloat(ticker.lastPrice),
            change24h: parseFloat(ticker.priceChangePercent),
            volume24h: parseFloat(ticker.quoteVolume),
          };
        }
        return market;
      });
      
      return NextResponse.json({
        data: updatedMarkets,
        timestamp: new Date().toISOString()
      });
    }
    
    throw new Error('Binance API not reachable');
  } catch (error) {
    console.log("Failed to fetch live markets from Binance, falling back to cached mock data:", error);
    return NextResponse.json({
      data: MOCK_MARKETS,
      timestamp: new Date().toISOString(),
      isFallback: true
    });
  }
}

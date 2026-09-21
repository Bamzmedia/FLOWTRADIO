import { NextResponse } from 'next/server';
import { fetchNadoAllProducts } from '@/nado/nadoApi';

export const dynamic = 'force-dynamic';

const CANONICAL_MARKETS = [
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
    const productsData = await fetchNadoAllProducts();
    if (productsData && productsData.perp_products) {
      const productMap: Record<number, string> = {
        2: 'btc',
        4: 'eth',
        8: 'sol',
      };
      
      const priceMap = new Map<string, number>();
      productsData.perp_products.forEach((p: any) => {
        const id = productMap[p.product_id];
        if (id) {
          priceMap.set(id, parseFloat(p.oracle_price_x18) / 1e18);
        }
      });
      
      const updatedMarkets = CANONICAL_MARKETS.map(market => {
        const price = priceMap.get(market.id);
        if (price !== undefined) {
          return {
            ...market,
            price: price,
          };
        }
        return market;
      });
      
      return NextResponse.json({
        data: updatedMarkets,
        timestamp: new Date().toISOString()
      });
    }
    
    throw new Error('Nado API not reachable');
  } catch (error) {
    console.log("Failed to fetch live markets from Nado, falling back to cached market data:", error);
    return NextResponse.json({
      data: CANONICAL_MARKETS,
      timestamp: new Date().toISOString(),
      isFallback: true
    });
  }
}

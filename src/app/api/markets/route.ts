import { NextResponse } from 'next/server';

const MOCK_MARKETS = [
  { id: 'nado', symbol: 'NADO', name: 'Nado Token', price: 2.45, change24h: 12.5, volume24h: 15400000, fundingRate: 0.01, oi: 5200000 },
  { id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 92450.00, change24h: 2.4, volume24h: 845000000, fundingRate: 0.005, oi: 154000000 },
  { id: 'eth', symbol: 'ETH', name: 'Ethereum', price: 4120.50, change24h: -1.2, volume24h: 420000000, fundingRate: -0.002, oi: 89000000 },
  { id: 'sol', symbol: 'SOL', name: 'Solana', price: 148.90, change24h: 8.5, volume24h: 156000000, fundingRate: 0.015, oi: 45000000 },
  { id: 'avax', symbol: 'AVAX', name: 'Avalanche', price: 35.40, change24h: 1.5, volume24h: 45000000, fundingRate: 0.008, oi: 12000000 },
  { id: 'link', symbol: 'LINK', name: 'Chainlink', price: 18.20, change24h: -4.2, volume24h: 32000000, fundingRate: -0.01, oi: 8500000 },
  { id: 'arb', symbol: 'ARB', name: 'Arbitrum', price: 1.15, change24h: 4.2, volume24h: 28000000, fundingRate: 0.005, oi: 6200000 },
  { id: 'doge', symbol: 'DOGE', name: 'Dogecoin', price: 0.14, change24h: -8.5, volume24h: 85000000, fundingRate: -0.02, oi: 18000000 },
];

export async function GET() {
  try {
    // Attempt to fetch live data from the Nado API
    const response = await fetch('https://api.nado.xyz/v1/markets', {
      // Add a timeout or specific headers here if needed in the future
    });
    
    if (response.ok) {
      const liveData = await response.json();
      return NextResponse.json({
        data: liveData,
        timestamp: new Date().toISOString()
      });
    }
    
    // If the API endpoint doesn't exist yet (e.g. 404), throw to trigger fallback
    throw new Error('API not available yet');
    
  } catch (error) {
    console.log("Nado API not reachable, falling back to mock data");
    
    // Fallback to mock data while backend team sets up the API
    await new Promise((resolve) => setTimeout(resolve, 600));
    
    return NextResponse.json({
      data: MOCK_MARKETS,
      timestamp: new Date().toISOString(),
      isFallback: true
    });
  }
}

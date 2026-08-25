import { NextResponse } from 'next/server';

const MOCK_TRADES = [
  { id: 1, pair: 'NADO-PERP', type: 'Long', leverage: 10, entry: 2.45, exit: 2.85, pnl: 400, date: '2026-08-25T10:30:00Z', status: 'closed' },
  { id: 2, pair: 'BTC-PERP', type: 'Short', leverage: 50, entry: 92400, exit: 91200, pnl: 1200, date: '2026-08-24T15:45:00Z', status: 'closed' },
  { id: 3, pair: 'ETH-PERP', type: 'Long', leverage: 20, entry: 4100, exit: 4050, pnl: -250, date: '2026-08-22T09:15:00Z', status: 'closed' },
  { id: 4, pair: 'SOL-PERP', type: 'Long', leverage: 15, entry: 145.2, exit: 160.8, pnl: 850, date: '2026-08-20T14:20:00Z', status: 'closed' },
];

export async function GET() {
  try {
    const response = await fetch('https://api.nado.xyz/v1/profile/history');
    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        data: data.trades,
        totalPnL: data.totalPnL,
        winRate: data.winRate,
        totalVolume: data.totalVolume,
        timestamp: new Date().toISOString()
      });
    }
    throw new Error('API not available yet');
  } catch (error) {
    console.log("Nado API not reachable, falling back to mock data");
    await new Promise((resolve) => setTimeout(resolve, 500));
    return NextResponse.json({
      data: MOCK_TRADES,
      totalPnL: 2200,
      winRate: 75,
      totalVolume: 125000,
      timestamp: new Date().toISOString(),
      isFallback: true
    });
  }
}

import { NextResponse } from 'next/server';

const MOCK_LEADERBOARD = [
  { rank: 1, name: 'WhaleSniper', address: '0x1A2b...3c4D', roi: 1245.5, pnl: 450200, winRate: 78.5, volume: 15200000 },
  { rank: 2, name: 'NadoChad', address: '0x4F5g...6h7J', roi: 980.2, pnl: 310500, winRate: 82.1, volume: 8500000 },
  { rank: 3, name: 'AlphaSeeker', address: '0x9K8l...7m6N', roi: 850.8, pnl: 285000, winRate: 71.4, volume: 12400000 },
  { rank: 4, name: 'RiskOn', address: '0x3P4q...5r6S', roi: 620.1, pnl: 150000, winRate: 65.2, volume: 5600000 },
  { rank: 5, name: 'SafeYield', address: '0x7T8u...9v0W', roi: 410.5, pnl: 95000, winRate: 91.0, volume: 2100000 },
  { rank: 6, name: 'DegenApe', address: '0x1X2y...3z4A', roi: 350.2, pnl: 82000, winRate: 55.5, volume: 34000000 },
  { rank: 7, name: 'QuantFund', address: '0x5B6c...7d8E', roi: 290.4, pnl: 65000, winRate: 88.8, volume: 9500000 },
  { rank: 8, name: 'MoonWalker', address: '0x9F0g...1h2J', roi: 210.9, pnl: 45000, winRate: 62.3, volume: 4200000 },
];

export async function GET() {
  try {
    const response = await fetch('https://api.nado.xyz/v1/leaderboard');
    if (response.ok) {
      return NextResponse.json({
        data: await response.json(),
        timestamp: new Date().toISOString()
      });
    }
    throw new Error('API not available yet');
  } catch (error) {
    console.log("Nado API not reachable, falling back to mock data");
    await new Promise((resolve) => setTimeout(resolve, 800));
    return NextResponse.json({
      data: MOCK_LEADERBOARD,
      timestamp: new Date().toISOString(),
      isFallback: true
    });
  }
}

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://api.nado.xyz/v1/profile/history');
    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        data: data.trades || [],
        totalPnL: data.totalPnL || 0,
        winRate: data.winRate || 0,
        totalVolume: data.totalVolume || 0,
        timestamp: new Date().toISOString()
      });
    }
    throw new Error('API not available yet');
  } catch (error) {
    return NextResponse.json({
      data: [],
      totalPnL: 0,
      winRate: 0,
      totalVolume: 0,
      timestamp: new Date().toISOString(),
      isFallback: true
    });
  }
}

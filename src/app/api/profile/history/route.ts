import { NextResponse } from 'next/server';
import { fetchPastFills } from '@/nado/nadoApi';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sender = searchParams.get('sender');

  if (!sender) {
    return NextResponse.json({
      data: [],
      totalPnL: 0,
      winRate: 0,
      totalVolume: 0,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const fills = await fetchPastFills(sender);

    let totalVolume = 0;
    let totalPnL = 0;
    let wins = 0;

    fills.forEach((fill) => {
      totalVolume += fill.amount * fill.price;
      totalPnL -= fill.fee || 0;
      if (totalPnL >= 0) wins++;
    });

    const winRate = fills.length > 0 ? Math.round((wins / fills.length) * 100) : 0;

    return NextResponse.json({
      data: fills,
      totalPnL,
      winRate,
      totalVolume,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      data: [],
      totalPnL: 0,
      winRate: 0,
      totalVolume: 0,
      timestamp: new Date().toISOString(),
    });
  }
}


import { NextResponse } from 'next/server';

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
    // Fallback: Return top competitive traders on NEOTRADIO
    const fallbackTraders = [
      {
        rank: 1,
        name: 'ApexAlpha.eth',
        address: '0x71C...3a91',
        roi: 412.8,
        pnl: 148520,
        winRate: 78.5,
        volume: 4250000,
      },
      {
        rank: 2,
        name: 'VeloQuant',
        address: '0x94B...8e12',
        roi: 326.4,
        pnl: 98400,
        winRate: 72.1,
        volume: 2890000,
      },
      {
        rank: 3,
        name: 'SatoshiScalper',
        address: '0x32D...f40c',
        roi: 248.9,
        pnl: 64120,
        winRate: 69.4,
        volume: 1780000,
      },
      {
        rank: 4,
        name: 'DeltaNeutral_Pro',
        address: '0x55E...19d4',
        roi: 185.3,
        pnl: 45200,
        winRate: 84.2,
        volume: 3450000,
      },
      {
        rank: 5,
        name: 'WhaleWatch_0x',
        address: '0x18A...6b77',
        roi: 142.1,
        pnl: 38900,
        winRate: 65.8,
        volume: 1250000,
      },
      {
        rank: 6,
        name: 'HyperLiquidator',
        address: '0x88C...229f',
        roi: 118.7,
        pnl: 29400,
        winRate: 63.0,
        volume: 980000,
      },
      {
        rank: 7,
        name: 'CipherTrade',
        address: '0x43F...d11e',
        roi: 94.5,
        pnl: 21800,
        winRate: 61.5,
        volume: 820000,
      },
    ];

    return NextResponse.json({
      data: fallbackTraders,
      timestamp: new Date().toISOString(),
      isFallback: true
    });
  }
}

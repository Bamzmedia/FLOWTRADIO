import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const archiveUrl = 'https://archive.prod.nado.xyz/v1';
    const response = await fetch(archiveUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      body: JSON.stringify({ matches: { limit: 250 } }),
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      throw new Error(`Archive returned ${response.status}`);
    }

    const data = await response.json();
    const traderMap: Record<
      string,
      { address: string; volume: number; pnl: number; count: number; wins: number }
    > = {};

    for (const match of data.matches || []) {
      const sender = match.order?.sender || '';
      if (!sender || sender.length < 42) continue;
      const wallet = sender.slice(0, 42).toLowerCase();
      if (wallet === '0x0000000000000000000000000000000000000000') continue;

      if (!traderMap[wallet]) {
        traderMap[wallet] = { address: wallet, volume: 0, pnl: 0, count: 0, wins: 0 };
      }

      const quoteFilled = Math.abs(parseFloat(match.quote_filled || '0')) / 1e18;
      const realizedPnl = parseFloat(match.realized_pnl || '0') / 1e18;

      traderMap[wallet].volume += quoteFilled;
      traderMap[wallet].pnl += realizedPnl;
      traderMap[wallet].count += 1;
      if (realizedPnl > 0.0001) {
        traderMap[wallet].wins += 1;
      }
    }

    const sortedWallets = Object.values(traderMap).sort((a, b) => b.volume - a.volume);

    const traders = sortedWallets.slice(0, 50).map((t, index) => {
      const shortAddress = `${t.address.slice(0, 6)}...${t.address.slice(-4)}`;
      const name = `Trader ${shortAddress}`;
      const winRate = t.count > 0 ? Math.round((t.wins / t.count) * 100) : 0;
      
      // Calculate realistic ROI based on estimated margin capital (~volume / 20)
      const estimatedMargin = Math.max(10, t.volume / 20);
      const rawRoi = (t.pnl / estimatedMargin) * 100;
      const roi = Math.round(rawRoi * 10) / 10;
      const pnl = Math.round(t.pnl * 100) / 100;
      const volume = Math.round(t.volume * 100) / 100;

      return {
        rank: index + 1,
        name,
        address: shortAddress,
        fullAddress: t.address,
        roi,
        pnl,
        winRate,
        volume,
        isNetworkTrader: true,
      };
    });

    return NextResponse.json({
      data: traders,
      timestamp: new Date().toISOString(),
      isFallback: false,
    });
  } catch (error: any) {
    console.warn('[LeaderboardAPI] Error aggregating matches from archive:', error?.message);
    return NextResponse.json({
      data: [],
      timestamp: new Date().toISOString(),
      isFallback: true,
    });
  }
}

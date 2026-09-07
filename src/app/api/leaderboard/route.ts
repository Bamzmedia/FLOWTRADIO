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
    return NextResponse.json({
      data: [],
      timestamp: new Date().toISOString(),
      isFallback: true
    });
  }
}

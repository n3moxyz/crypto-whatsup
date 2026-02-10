import { NextRequest, NextResponse } from "next/server";

const COINGECKO_API = "https://api.coingecko.com/api/v3";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const daysParam = searchParams.get("days") || "30";

    let days: number;
    if (daysParam === "max") {
      // CoinGecko free tier caps at 365 days
      days = 365;
    } else if (daysParam === "ytd") {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      days = Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      days = parseInt(daysParam, 10);
      if (isNaN(days) || days < 1) days = 30;
    }

    const response = await fetch(
      `${COINGECKO_API}/coins/ethereum/market_chart?vs_currency=btc&days=${days}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 300 },
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      prices: data.prices as [number, number][],
    });
  } catch (error) {
    console.error("Error fetching ETH/BTC history:", error);
    return NextResponse.json(
      { error: "Failed to fetch ETH/BTC history" },
      { status: 500 }
    );
  }
}

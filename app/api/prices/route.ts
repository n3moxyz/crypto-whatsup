import { NextResponse } from "next/server";
import { fetchSpecificCoins, getDisplayItems } from "@/lib/coingecko";

export async function GET() {
  try {
    const coins = await fetchSpecificCoins();
    const displayItems = getDisplayItems(coins);

    return NextResponse.json({
      coins,
      displayItems,
    });
  } catch (error) {
    console.error("Error fetching prices:", error);
    return NextResponse.json(
      { error: "Failed to fetch crypto prices" },
      { status: 500 }
    );
  }
}

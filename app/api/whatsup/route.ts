import { NextResponse } from "next/server";
import { generateWhatsUp } from "@/lib/openai";
import { getCachedWhatsUp, setCachedWhatsUp, getCacheAge } from "@/lib/cache";

export async function GET() {
  try {
    // Check for cached data first
    const cached = await getCachedWhatsUp();

    if (cached) {
      return NextResponse.json({
        ...cached.data,
        timestamp: cached.timestamp,
        cached: true,
        cacheAge: getCacheAge(cached),
      });
    }

    // No valid cache, generate fresh data
    const data = await generateWhatsUp();

    // Cache the result
    await setCachedWhatsUp(data);

    return NextResponse.json({
      ...data,
      timestamp: new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    console.error("Error generating WhatsUp:", error);
    return NextResponse.json(
      { error: "Failed to generate market summary" },
      { status: 500 }
    );
  }
}

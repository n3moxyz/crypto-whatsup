import { NextRequest, NextResponse } from "next/server";
import { generateWhatsUp } from "@/lib/openai";
import { setCachedWhatsUp } from "@/lib/cache";

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // In production, verify the cron secret
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Cron: Refreshing WhatsUp cache...");

    const data = await generateWhatsUp();
    await setCachedWhatsUp(data);

    console.log("Cron: WhatsUp cache refreshed successfully");

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: "Cache refreshed successfully",
    });
  } catch (error) {
    console.error("Cron: Error refreshing WhatsUp cache:", error);
    return NextResponse.json(
      { error: "Failed to refresh cache" },
      { status: 500 }
    );
  }
}

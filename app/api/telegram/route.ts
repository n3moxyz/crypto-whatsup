import { NextRequest, NextResponse } from "next/server";
import { webhookCallback } from "grammy";
import { getBot } from "@/lib/telegram/bot";

// Verify webhook secret header
function verifyWebhookSecret(request: NextRequest): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    // If no secret configured, allow all requests (development mode)
    return true;
  }

  const headerSecret = request.headers.get("x-telegram-bot-api-secret-token");
  return headerSecret === secret;
}

export async function POST(request: NextRequest) {
  // Verify webhook secret
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const bot = getBot();

    // Create webhook handler
    const handleUpdate = webhookCallback(bot, "std/http");

    // Process the update
    return await handleUpdate(request);
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ status: "ok", bot: "Crypto What's Up" });
}

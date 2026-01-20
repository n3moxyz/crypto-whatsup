import { CallbackQueryContext } from "grammy";
import { BotContext } from "../bot";
import { generateWhatsUp } from "@/lib/openai";
import { getCachedWhatsUp, setCachedWhatsUp } from "@/lib/cache";
import {
  formatWhatsUpMessage,
  formatLoadingMessage,
  formatErrorMessage,
} from "../formatters";
import { getWhatsUpKeyboard } from "../keyboards";

async function getWhatsUpData(): Promise<import("@/lib/openai").WhatsUpData> {
  // Skip cache in development for testing
  const isDev = process.env.NODE_ENV === "development";

  if (!isDev) {
    // Try cache first (only in production)
    const cached = await getCachedWhatsUp();
    if (cached) {
      return cached.data;
    }
  }

  // Generate fresh data
  const data = await generateWhatsUp();

  // Cache it (for production)
  if (!isDev) {
    await setCachedWhatsUp(data);
  }

  return data;
}

export async function handleWhatsUp(ctx: BotContext): Promise<void> {
  // Send loading message first
  const loadingMsg = await ctx.reply(
    formatLoadingMessage("Analyzing market data"),
    { parse_mode: "HTML" }
  );

  const chatId = ctx.chat!.id;
  const messageId = loadingMsg.message_id;
  const api = ctx.api;

  // Fire and forget - don't await, let webhook return quickly
  (async () => {
    try {
      const data = await getWhatsUpData();

      await api.editMessageText(chatId, messageId, formatWhatsUpMessage(data), {
        parse_mode: "HTML",
        reply_markup: getWhatsUpKeyboard(),
      });
    } catch (error) {
      console.error("Error generating WhatsUp:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to generate market summary";

      await api.editMessageText(chatId, messageId, formatErrorMessage(errorMessage), {
        parse_mode: "HTML",
      });
    }
  })();
}

export async function handleWhatsUpCallback(
  ctx: CallbackQueryContext<BotContext>
): Promise<void> {
  // Answer the callback to remove loading state on button
  await ctx.answerCallbackQuery();

  // Edit message to show loading
  await ctx.editMessageText(formatLoadingMessage("Analyzing market data"), {
    parse_mode: "HTML",
  });

  const chatId = ctx.chat!.id;
  const messageId = ctx.callbackQuery.message?.message_id;
  const api = ctx.api;

  if (!messageId) return;

  // Fire and forget - don't await, let webhook return quickly
  (async () => {
    try {
      const data = await getWhatsUpData();

      await api.editMessageText(chatId, messageId, formatWhatsUpMessage(data), {
        parse_mode: "HTML",
        reply_markup: getWhatsUpKeyboard(),
      });
    } catch (error) {
      console.error("Error generating WhatsUp:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to generate market summary";

      await api.editMessageText(chatId, messageId, formatErrorMessage(errorMessage), {
        parse_mode: "HTML",
      });
    }
  })();
}

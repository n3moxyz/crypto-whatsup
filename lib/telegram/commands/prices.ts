import { CallbackQueryContext } from "grammy";
import { BotContext } from "../bot";
import {
  fetchTop100Coins,
  fetchSpecificCoins,
  getDisplayItems,
  getTopMovers,
} from "@/lib/coingecko";
import {
  formatPricesMessage,
  formatLoadingMessage,
  formatErrorMessage,
} from "../formatters";
import { getPricesKeyboard } from "../keyboards";

// Default coins to show
const DEFAULT_COIN_IDS = ["bitcoin", "ethereum", "solana", "ripple", "hyperliquid"];

async function fetchPriceData() {
  const [selectedCoins, top100Coins] = await Promise.all([
    fetchSpecificCoins(DEFAULT_COIN_IDS),
    fetchTop100Coins(),
  ]);

  const displayItems = getDisplayItems(selectedCoins, DEFAULT_COIN_IDS);
  const topMovers = getTopMovers(top100Coins);

  return { displayItems, topMovers };
}

export async function handlePrices(ctx: BotContext): Promise<void> {
  // Send loading message first
  const loadingMsg = await ctx.reply(
    formatLoadingMessage("Fetching prices"),
    { parse_mode: "HTML" }
  );

  const chatId = ctx.chat!.id;
  const messageId = loadingMsg.message_id;
  const api = ctx.api;

  // Fire and forget - don't await, let webhook return quickly
  (async () => {
    try {
      const { displayItems, topMovers } = await fetchPriceData();

      await api.editMessageText(chatId, messageId, formatPricesMessage(displayItems, topMovers), {
        parse_mode: "HTML",
        reply_markup: getPricesKeyboard(),
      });
    } catch (error) {
      console.error("Error fetching prices:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch prices";

      await api.editMessageText(chatId, messageId, formatErrorMessage(errorMessage), {
        parse_mode: "HTML",
      });
    }
  })();
}

export async function handlePricesCallback(
  ctx: CallbackQueryContext<BotContext>
): Promise<void> {
  await ctx.answerCallbackQuery();

  await ctx.editMessageText(formatLoadingMessage("Fetching prices"), {
    parse_mode: "HTML",
  });

  const chatId = ctx.chat!.id;
  const messageId = ctx.callbackQuery.message?.message_id;
  const api = ctx.api;

  if (!messageId) return;

  // Fire and forget - don't await, let webhook return quickly
  (async () => {
    try {
      const { displayItems, topMovers } = await fetchPriceData();

      await api.editMessageText(chatId, messageId, formatPricesMessage(displayItems, topMovers), {
        parse_mode: "HTML",
        reply_markup: getPricesKeyboard(),
      });
    } catch (error) {
      console.error("Error fetching prices:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch prices";

      await api.editMessageText(chatId, messageId, formatErrorMessage(errorMessage), {
        parse_mode: "HTML",
      });
    }
  })();
}

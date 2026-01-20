import { Bot, Context, session, SessionFlavor } from "grammy";
import { handleStart } from "./commands/start";
import { handleWhatsUp, handleWhatsUpCallback } from "./commands/whatsup";
import { handlePrices, handlePricesCallback } from "./commands/prices";
import { handleReport, handleReportPassword } from "./commands/report";

interface SessionData {
  awaitingPassword?: boolean;
}

export type BotContext = Context & SessionFlavor<SessionData>;

function createBot(): Bot<BotContext> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const bot = new Bot<BotContext>(token);

  // Session middleware for password flow
  bot.use(
    session({
      initial: (): SessionData => ({
        awaitingPassword: false,
      }),
    })
  );

  // Register commands
  bot.command("start", handleStart);
  bot.command("whatsup", handleWhatsUp);
  bot.command("prices", handlePrices);
  bot.command("report", handleReport);

  // Handle callback queries (inline button presses)
  bot.callbackQuery("refresh_whatsup", handleWhatsUpCallback);
  bot.callbackQuery("show_prices", handlePricesCallback);
  bot.callbackQuery("refresh_prices", handlePricesCallback);
  bot.callbackQuery("show_whatsup", handleWhatsUpCallback);

  // Handle text messages (for password input)
  bot.on("message:text", async (ctx) => {
    if (ctx.session.awaitingPassword) {
      await handleReportPassword(ctx);
    }
  });

  return bot;
}

// Singleton bot instance
let botInstance: Bot<BotContext> | null = null;

export function getBot(): Bot<BotContext> {
  if (!botInstance) {
    botInstance = createBot();
  }
  return botInstance;
}

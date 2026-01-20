import { BotContext } from "../bot";
import { formatWelcomeMessage } from "../formatters";
import { getStartKeyboard } from "../keyboards";

export async function handleStart(ctx: BotContext): Promise<void> {
  await ctx.reply(formatWelcomeMessage(), {
    parse_mode: "HTML",
    reply_markup: getStartKeyboard(),
  });
}

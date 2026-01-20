import { InlineKeyboard } from "grammy";

export function getStartKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📈 What's Up", "show_whatsup")
    .text("💰 Prices", "show_prices");
}

export function getWhatsUpKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔄 Refresh", "refresh_whatsup")
    .text("💰 Prices", "show_prices");
}

export function getPricesKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔄 Refresh", "refresh_prices")
    .text("📈 What's Up", "show_whatsup");
}

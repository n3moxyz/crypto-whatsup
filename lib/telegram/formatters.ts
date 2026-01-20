import { WhatsUpData, BulletPoint, SubPoint } from "@/lib/openai";
import { DisplayItem, TopMover } from "@/lib/coingecko";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatSourceLink(url: string): string {
  // Extract domain or use "source" for display
  try {
    const domain = new URL(url).hostname.replace("www.", "");
    // Shorten x.com URLs
    if (domain === "x.com" || domain === "twitter.com") {
      return `<a href="${url}">source</a>`;
    }
    return `<a href="${url}">${escapeHtml(domain)}</a>`;
  } catch {
    return `<a href="${url}">source</a>`;
  }
}

function formatBulletPoint(bullet: BulletPoint): string {
  let text = `• ${escapeHtml(bullet.main)}`;

  // Convert *italics* to <i>italics</i>
  text = text.replace(/\*([^*]+)\*/g, "<i>$1</i>");

  if (bullet.sourceUrl) {
    text += ` [${formatSourceLink(bullet.sourceUrl)}]`;
  }

  if (bullet.subPoints && bullet.subPoints.length > 0) {
    const subPointsText = bullet.subPoints
      .map((sp: SubPoint) => {
        let subText = `  → ${escapeHtml(sp.text)}`;
        if (sp.sourceUrl) {
          subText += ` [${formatSourceLink(sp.sourceUrl)}]`;
        }
        return subText;
      })
      .join("\n");
    text += "\n" + subPointsText;
  }

  return text;
}

export function formatWhatsUpMessage(data: WhatsUpData): string {
  const lines: string[] = [];

  // Header
  lines.push("📈 <b>Crypto Market Update</b>\n");

  // Bullets with sub-points
  const bulletsText = data.bullets.map(formatBulletPoint).join("\n\n");
  lines.push(bulletsText);

  // Conclusion / Bias
  if (data.conclusion) {
    lines.push("");
    lines.push(`<b>Bias:</b> <i>${escapeHtml(data.conclusion)}</i>`);
  }

  return lines.join("\n");
}

function formatPrice(price: number): string {
  if (price >= 1000) {
    return `$${(price / 1000).toFixed(1)}k`;
  } else if (price >= 1) {
    return `$${price.toFixed(2)}`;
  } else if (price >= 0.01) {
    return `$${price.toFixed(4)}`;
  } else {
    return `$${price.toFixed(6)}`;
  }
}

function formatPriceForDisplay(item: DisplayItem): string {
  if (item.isRatio) {
    return String(item.current_price);
  }

  const price = typeof item.current_price === "number"
    ? item.current_price
    : parseFloat(String(item.current_price));

  // Special formatting for major coins
  if (item.symbol === "BTC" && price >= 1000) {
    return `$${Math.round(price / 1000)}k`;
  }
  if (item.symbol === "ETH" && price >= 100) {
    return `$${(Math.round(price / 100) / 10).toFixed(1)}k`;
  }

  return formatPrice(price);
}

export function formatPricesMessage(
  displayItems: DisplayItem[],
  topMovers: { gainers: TopMover[]; losers: TopMover[] }
): string {
  const lines: string[] = [];

  // Header
  lines.push("💰 <b>Current Prices</b>\n");

  // Price list
  for (const item of displayItems) {
    const priceStr = formatPriceForDisplay(item);
    let line = `<b>${escapeHtml(item.symbol)}</b>: ${priceStr}`;

    if (item.price_change_percentage_24h !== null) {
      const change = item.price_change_percentage_24h;
      const changeStr = change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
      const emoji = change >= 0 ? "🟢" : "🔴";
      line += ` ${emoji} ${changeStr}`;
    }

    lines.push(line);
  }

  // Top Movers section
  if (topMovers.gainers.length > 0 || topMovers.losers.length > 0) {
    lines.push("");
    lines.push("📊 <b>Top Movers (24h):</b>");

    if (topMovers.gainers.length > 0) {
      lines.push("Gainers:");
      for (const g of topMovers.gainers.slice(0, 3)) {
        lines.push(`  🟢 ${escapeHtml(g.symbol)}: ${escapeHtml(g.change)}`);
      }
    }

    if (topMovers.losers.length > 0) {
      lines.push("Losers:");
      for (const l of topMovers.losers.slice(0, 3)) {
        lines.push(`  🔴 ${escapeHtml(l.symbol)}: ${escapeHtml(l.change)}`);
      }
    }
  }

  return lines.join("\n");
}

export function formatWelcomeMessage(): string {
  return `👋 <b>Welcome to Crypto What's Up!</b>

Get instant market intelligence and price updates.

<b>Available Commands:</b>
/whatsup - Market summary with analysis
/prices - Current prices for tracked coins
/report - Generate weekly report (admin only)

Use the buttons below or type commands directly.`;
}

export function formatLoadingMessage(action: string): string {
  return `⏳ ${escapeHtml(action)}...`;
}

export function formatErrorMessage(error: string): string {
  return `❌ <b>Error:</b> ${escapeHtml(error)}`;
}

export function formatReportMessage(report: string): string {
  // The report is in markdown, convert basic formatting to HTML
  let html = escapeHtml(report);

  // Convert **bold** to <b>bold</b>
  html = html.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");

  // Convert *italic* to <i>italic</i>
  html = html.replace(/\*([^*]+)\*/g, "<i>$1</i>");

  return `📋 <b>Weekly Report</b>\n\n${html}`;
}

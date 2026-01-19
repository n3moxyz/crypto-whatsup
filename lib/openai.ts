import { fetchSpecificCoins, CoinData } from "./coingecko";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

export interface WhatsUpData {
  bullets: string[];
  sentiment: "bullish" | "bearish" | "neutral";
  topMovers: {
    gainers: Array<{ symbol: string; change: string }>;
    losers: Array<{ symbol: string; change: string }>;
  };
}

// Format prices as requested
function formatBtcPrice(price: number): string {
  const rounded = Math.round(price / 1000);
  return `$${rounded}k`;
}

function formatEthPrice(price: number): string {
  const rounded = Math.round(price / 100) / 10;
  return `$${rounded}k`;
}

function formatSolPrice(price: number): string {
  const rounded = Math.round(price / 10) * 10;
  return `$${rounded}`;
}

function formatOtherPrice(price: number): string {
  if (price >= 1000) {
    return `$${(price / 1000).toFixed(1)}k`;
  } else if (price >= 1) {
    return `$${price.toFixed(0)}`;
  } else {
    return `$${price.toFixed(2)}`;
  }
}

// Fetch recent crypto news
async function fetchCryptoNews(): Promise<string[]> {
  try {
    // Try CryptoPanic public API
    const response = await fetch(
      "https://cryptopanic.com/api/free/v1/posts/?public=true",
      { next: { revalidate: 300 } }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.results && Array.isArray(data.results)) {
        return data.results
          .slice(0, 10)
          .map((item: { title: string }) => item.title);
      }
    }
  } catch (e) {
    console.log("CryptoPanic fetch failed, trying alternative...");
  }

  try {
    // Alternative: CoinGecko status updates
    const response = await fetch(
      "https://api.coingecko.com/api/v3/status_updates?per_page=10",
      { next: { revalidate: 300 } }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.status_updates && Array.isArray(data.status_updates)) {
        return data.status_updates
          .slice(0, 10)
          .map((item: { user_title: string; description: string }) =>
            `${item.user_title}: ${item.description?.slice(0, 100)}`
          );
      }
    }
  } catch (e) {
    console.log("CoinGecko status fetch failed");
  }

  return [];
}

export async function generateWhatsUp(): Promise<WhatsUpData> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  // Fetch real prices and news in parallel
  const [coins, newsHeadlines] = await Promise.all([
    fetchSpecificCoins(),
    fetchCryptoNews()
  ]);

  // Sort by 24h change to get real top movers
  const sortedByChange = [...coins].sort(
    (a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h
  );

  const gainers = sortedByChange
    .filter(c => c.price_change_percentage_24h > 0)
    .slice(0, 3)
    .map(c => ({
      symbol: c.symbol.toUpperCase(),
      change: `+${c.price_change_percentage_24h.toFixed(1)}%`
    }));

  const losers = sortedByChange
    .filter(c => c.price_change_percentage_24h < 0)
    .slice(-3)
    .reverse()
    .map(c => ({
      symbol: c.symbol.toUpperCase(),
      change: `${c.price_change_percentage_24h.toFixed(1)}%`
    }));

  // Format price data with proper rounding
  const btc = coins.find(c => c.symbol === "btc");
  const eth = coins.find(c => c.symbol === "eth");
  const sol = coins.find(c => c.symbol === "sol");
  const bnb = coins.find(c => c.symbol === "bnb");
  const xrp = coins.find(c => c.symbol === "xrp");

  const priceLines: string[] = [];
  if (btc) priceLines.push(`BTC: ${formatBtcPrice(btc.current_price)} (24h: ${btc.price_change_percentage_24h >= 0 ? '+' : ''}${btc.price_change_percentage_24h.toFixed(1)}%)`);
  if (eth) priceLines.push(`ETH: ${formatEthPrice(eth.current_price)} (24h: ${eth.price_change_percentage_24h >= 0 ? '+' : ''}${eth.price_change_percentage_24h.toFixed(1)}%)`);
  if (sol) priceLines.push(`SOL: ${formatSolPrice(sol.current_price)} (24h: ${sol.price_change_percentage_24h >= 0 ? '+' : ''}${sol.price_change_percentage_24h.toFixed(1)}%)`);
  if (bnb) priceLines.push(`BNB: ${formatOtherPrice(bnb.current_price)} (24h: ${bnb.price_change_percentage_24h >= 0 ? '+' : ''}${bnb.price_change_percentage_24h.toFixed(1)}%)`);
  if (xrp) priceLines.push(`XRP: ${formatOtherPrice(xrp.current_price)} (24h: ${xrp.price_change_percentage_24h >= 0 ? '+' : ''}${xrp.price_change_percentage_24h.toFixed(1)}%)`);

  const priceContext = priceLines.join('\n');

  // Determine overall sentiment
  const avgChange = coins.reduce((sum, c) => sum + c.price_change_percentage_24h, 0) / coins.length;

  let sentiment: "bullish" | "bearish" | "neutral";
  if (avgChange > 2) sentiment = "bullish";
  else if (avgChange < -2) sentiment = "bearish";
  else sentiment = "neutral";

  // Build news context
  const newsContext = newsHeadlines.length > 0
    ? `\n\nRECENT HEADLINES:\n${newsHeadlines.map(h => `- ${h}`).join('\n')}`
    : '';

  const systemPrompt = `You are a crypto market analyst providing a morning briefing for Asia-timezone traders. US market hours just ended.

Your job is to explain WHY prices moved, not just state the numbers. Connect price action to:
- Crypto-specific news (ETF flows, exchange issues, protocol updates, whale movements)
- Macro backdrop ONLY if relevant (US equities futures, Fed policy, Trump tariffs, economic data, risk-on/risk-off sentiment)

FORMATTING RULES:
- BTC prices in rounded thousands: $104k, $98k
- ETH prices in rounded hundreds: $3.2k, $2.8k
- SOL prices rounded to nearest 10: $240, $180
- Price changes in *italics* with 1 decimal: *+2.3%*, *-1.5%*

Be specific about what happened during US hours. If macro factors (equities, tariffs, Fed) are driving crypto, mention them. If crypto is moving independently, focus on crypto-specific catalysts. Don't force macro commentary if it's not relevant.`;

  const userPrompt = `CURRENT PRICES (live data):
${priceContext}
${newsContext}

It's morning in Asia. US trading session just closed. Based on the price data${newsHeadlines.length > 0 ? ' and recent headlines' : ''}, write 4-5 bullet points explaining:

1. What happened overnight? Why did prices move this way?
2. Any crypto-specific catalysts (ETF flows, whale moves, protocol news)?
3. Macro impact if relevant (US equities, tariffs, Fed) - only mention if it's actually driving crypto
4. Key levels to watch for the Asia session

FORMAT: Return ONLY a JSON array of bullet strings. Use the price formatting rules (BTC in $Xk, ETH in $X.Xk, SOL in $XX0). Put percentages in *italics*.

Example: ["BTC holding $104k after *+1.2%* move on ETF inflow news", "S&P futures down 0.5% overnight adding pressure, but crypto showing relative strength", "ETH lagging at $3.2k, *-0.5%* as gas fees spike"]`;

  const response = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Claude API error: ${response.status}`
    );
  }

  const data = await response.json();

  if (!data.content || !data.content[0] || !data.content[0].text) {
    throw new Error("Invalid response from Claude API");
  }

  const textContent = data.content[0].text;

  // Parse the JSON array from the response
  const jsonMatch = textContent.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Failed to parse WhatsUp response");
  }

  const bullets = JSON.parse(jsonMatch[0]) as string[];

  return {
    bullets,
    sentiment,
    topMovers: { gainers, losers }
  };
}

import { fetchSpecificCoins, CoinData } from "./coingecko";
import { fetchCryptoIntelFromGrok, GrokCryptoIntel } from "./grok";

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


export async function generateWhatsUp(): Promise<WhatsUpData> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  // Fetch real prices and Grok intelligence in parallel
  const [coins, grokIntel] = await Promise.all([
    fetchSpecificCoins(),
    fetchCryptoIntelFromGrok()
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

  // Get current timestamp for accuracy
  const now = new Date();
  const currentDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });
  const currentTime = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC'
  });

  // Build Grok intelligence context
  const hasGrokIntel = grokIntel.breakingNews.length > 0 || grokIntel.narratives.length > 0;

  let intelContext = '';
  if (hasGrokIntel) {
    intelContext = '\n\n=== VERIFIED X/TWITTER INTELLIGENCE (last 24-48h) ===';

    if (grokIntel.breakingNews.length > 0) {
      intelContext += `\n\nBREAKING NEWS:\n${grokIntel.breakingNews.map(n => `• ${n}`).join('\n')}`;
    }

    if (grokIntel.narratives.length > 0) {
      intelContext += `\n\nNARRATIVES BEING DISCUSSED:\n${grokIntel.narratives.map(n => `• ${n}`).join('\n')}`;
    }

    if (grokIntel.keyTweets.length > 0) {
      intelContext += `\n\nKEY INSIGHTS FROM CT:\n${grokIntel.keyTweets.map(t => `• ${t}`).join('\n')}`;
    }

    if (grokIntel.sentiment) {
      intelContext += `\n\nCT SENTIMENT: ${grokIntel.sentiment}`;
    }
  }

  const systemPrompt = `You are a crypto market analyst. Your #1 priority is ACCURACY. You would rather say less than say something wrong.

CURRENT DATE/TIME: ${currentDate}, ${currentTime} UTC

CRITICAL RULES - MUST FOLLOW:
1. ONLY use information from the provided price data and X/Twitter intelligence
2. NEVER make up statistics, ratios, percentages, or specific numbers not in the data
3. NEVER reference past events as if they're upcoming (e.g., if it's January, don't say "December rate cut is probable")
4. If you don't have information about something, DON'T MENTION IT - skip that topic entirely
5. Only mention specific sectors (AI, DePIN, memes, etc.) if there are SPECIFIC TOKENS with notable moves in the data
6. The price data shows ACTUAL current prices and 24h changes - use these exact numbers
7. If X/Twitter intel is empty or sparse, focus only on what you can verify from the price data

FORMATTING:
- BTC: $104k format (use actual price from data)
- ETH: $3.2k format (use actual price from data)
- SOL: $240 format (use actual price from data)
- Percentages in *italics*: *+2.3%* (use actual % from data)

ACCURACY > DETAIL. Say less if unsure. Never hallucinate.`;

  const userPrompt = `TIMESTAMP: ${currentDate}, ${currentTime} UTC

LIVE PRICE DATA (verified):
${priceContext}
${intelContext}

Based ONLY on the data above, write 4-6 bullet points. For each bullet:
- Only state facts you can verify from the provided data
- Use the exact prices and percentages from the price data
- If referencing X/Twitter intel, only include what was actually provided
- If a category has no relevant data, skip it entirely

TOPICS TO COVER (only if you have verified data):
1. Price action summary - what the actual numbers show
2. Any breaking news from the X intel (if provided)
3. Notable movers and why (only if you have context from the intel)
4. Market sentiment (only if clearly indicated in the data)

DO NOT:
- Make up ETF flow numbers unless specifically provided
- Invent whale wallet addresses or movements
- Reference events from weeks/months ago as current
- Mention sectors without specific token context
- Add "key levels" unless you have actual data for them

FORMAT: Return ONLY a JSON array of bullet strings.

If the X/Twitter intel is empty, a valid response might be:
[
  "BTC at $104k (*+1.2%* 24h) - price action steady with no major catalysts in the last 24h",
  "ETH holding $3.2k (*-0.5%*) - underperforming BTC slightly",
  "Market sentiment unclear - limited breaking news in the last 48h"
]`;

  const response = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
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

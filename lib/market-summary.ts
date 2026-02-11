import { fetchSpecificCoins } from "./coingecko";
import { fetchCryptoIntelFromGrok, SourcedClaim, ThemeInsight } from "./grok";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

export interface SubPoint {
  text: string;
  sourceUrl?: string;
}

export interface BulletPoint {
  main: string;
  sourceUrl?: string;
  subPoints?: SubPoint[];
}

export interface WhatsUpData {
  bullets: BulletPoint[];
  conclusion: string;
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
  const rounded = Math.round(price);
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
  const xrp = coins.find(c => c.symbol === "xrp");
  const hype = coins.find(c => c.symbol === "hype");

  const priceLines: string[] = [];
  if (btc) priceLines.push(`BTC: ${formatBtcPrice(btc.current_price)} (24h: ${btc.price_change_percentage_24h >= 0 ? '+' : ''}${btc.price_change_percentage_24h.toFixed(1)}%)`);
  if (eth) priceLines.push(`ETH: ${formatEthPrice(eth.current_price)} (24h: ${eth.price_change_percentage_24h >= 0 ? '+' : ''}${eth.price_change_percentage_24h.toFixed(1)}%)`);
  if (sol) priceLines.push(`SOL: ${formatSolPrice(sol.current_price)} (24h: ${sol.price_change_percentage_24h >= 0 ? '+' : ''}${sol.price_change_percentage_24h.toFixed(1)}%)`);
  if (hype) priceLines.push(`HYPE: ${formatOtherPrice(hype.current_price)} (24h: ${hype.price_change_percentage_24h >= 0 ? '+' : ''}${hype.price_change_percentage_24h.toFixed(1)}%)`);
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

  // Build Grok intelligence context with sources
  const hasGrokIntel = grokIntel.themes.length > 0 || grokIntel.breakingNews.length > 0 || grokIntel.priceDrivers.length > 0;

  // Format claims with source URLs
  const formatClaim = (c: SourcedClaim) => {
    if (c.sourceUrl) {
      return `• ${c.claim} [SOURCE: ${c.sourceUrl}]`;
    }
    return `• ${c.claim}`;
  };

  // Format theme insights
  const formatTheme = (t: ThemeInsight) => {
    let themeStr = `\n[${t.theme}] ${t.insight} (${t.implication.toUpperCase()})`;
    if (t.evidence.length > 0) {
      themeStr += '\n  Evidence:';
      t.evidence.forEach(e => {
        themeStr += `\n  ${formatClaim(e)}`;
      });
    }
    return themeStr;
  };

  let intelContext = '';
  if (hasGrokIntel) {
    intelContext = '\n\n=== VERIFIED X/TWITTER INTELLIGENCE (last 48h) ===';

    if (grokIntel.themes.length > 0) {
      intelContext += `\n\nKEY MARKET THEMES:${grokIntel.themes.map(formatTheme).join('\n')}`;
    }

    if (grokIntel.priceDrivers.length > 0) {
      intelContext += `\n\nADDITIONAL PRICE DRIVERS:\n${grokIntel.priceDrivers.map(formatClaim).join('\n')}`;
    }

    if (grokIntel.breakingNews.length > 0) {
      intelContext += `\n\nBREAKING NEWS:\n${grokIntel.breakingNews.map(formatClaim).join('\n')}`;
    }

    if (grokIntel.sentiment) {
      intelContext += `\n\nCT SENTIMENT: ${grokIntel.sentiment}`;
    }
  }

  const systemPrompt = `You are a senior crypto market analyst writing for a trading desk.
Your job is to provide ACTIONABLE INTELLIGENCE, not news summaries.

CURRENT DATE/TIME: ${currentDate}, ${currentTime} UTC

YOUR GOAL: Write analytical insights that explain WHAT is happening AND WHY it matters.
Frame observations as market narratives, not just price reports.

CRITICAL THINKING - ALWAYS ASK "HOW DOES THIS AFFECT PRICE?":
For EVERY claim you consider including, ask yourself:
- "Does this actually cause people to buy or sell?"
- "What is the MECHANISM by which this moves price?"
- "Is this correlation or causation?"

BE SKEPTICAL of claims like:
- "Network activity surge signals bullishness" → Does more transactions = more buying pressure? Usually NO.
- "Transaction volume at all-time high" → Volume ≠ demand. Could be spam, airdrops, or neutral activity.
- "Active addresses increasing" → More users doesn't automatically mean price goes up.
- "TVL increasing" → Locked value can increase while price stays flat or drops.
- "Whale accumulation" → One whale buying means another entity sold. Net effect often neutral.

ONLY claim bullish/bearish when there's a CLEAR mechanism:
✓ "ETF inflows of $1.2B = direct buying pressure from institutions"
✓ "Exchange outflows suggest holders moving to cold storage = reduced sell pressure"
✓ "Fed rate cut = cheaper borrowing, risk-on sentiment, flows into crypto"
✓ "Major unlock event = supply increase = sell pressure"
✓ "Liquidation cascade = forced selling = bearish"

CRITICAL RULES - MUST FOLLOW:
1. ONLY use information from the provided price data and X/Twitter intelligence
2. NEVER make up statistics, ratios, percentages, or specific numbers not in the data
3. NEVER reference past events as if they're upcoming (e.g., if it's January, don't say "December rate cut is probable")
4. If you don't have information about something, DON'T MENTION IT - skip that topic entirely
5. Only mention specific sectors (AI, DePIN, memes, etc.) if there are SPECIFIC TOKENS with notable moves in the data
6. The price data shows ACTUAL current prices and 24h changes - use these exact numbers
7. If X/Twitter intel is empty or sparse, focus only on what you can verify from the price data
8. Don't cite vague "on-chain metrics" as bullish/bearish unless you can explain the direct price mechanism

QUALITY GUIDANCE - BAD vs GOOD examples:

BAD: "BTC dropped to $93k (-2.2%)"
GOOD: "Market-wide selling pressure: BTC $93k (*-2.2%*), ETH $3.2k (*-3.3%*), SOL $130 (*-6.1%*)"

BAD: "SEC delayed ETF decision"
GOOD: "Regulatory uncertainty weighing on sentiment despite positive ETF flows"

BAD: "Prices went down today"
GOOD: "Federal Reserve policy uncertainty creating sideways action with elevated volatility"

BAD: "Network activity surge signals structural bullishness"
GOOD: "ETF inflows creating direct buying pressure" (explains the mechanism)

FORMATTING:
- BTC: $104k format (use actual price from data)
- ETH: $3.2k format (use actual price from data)
- SOL: $240 format (use actual price from data)
- Percentages in *italics*: *+2.3%* (use actual % from data)

Lead with the ANALYTICAL INSIGHT (the "so what"), then support with data. ACCURACY > DETAIL.`;

  const userPrompt = `TIMESTAMP: ${currentDate}, ${currentTime} UTC

LIVE PRICE DATA (verified):
${priceContext}
${intelContext}

Write 4-6 ANALYTICAL bullet points about the crypto market. Each should provide MARKET INTELLIGENCE, not just news.

STRUCTURE: For each bullet:
1. MAIN POINT: An analytical insight that explains what's happening AND why it matters
   - Frame it as a market narrative, not just a fact
   - Lead with the "so what" - the implication for traders
   - Include key price data inline with *italics* for percentages

2. SUB-POINTS: Supporting evidence explaining WHY (when available)
   - Each sub-point links to a source when provided in the intel
   - Connect the dots between events and price action
   - Only include if you have ACTUAL reasons from the X/Twitter intel

FORMAT: Return a JSON object with "bullets" array and "conclusion" string:
{
  "bullets": [
    {
      "main": "Regulatory uncertainty weighing on sentiment despite positive institutional flows",
      "subPoints": [
        {"text": "Senate crypto bill postponed after Coinbase CEO criticism", "sourceUrl": "https://x.com/..."},
        {"text": "Bitcoin ETF inflows of $1.2B signal continued institutional demand", "sourceUrl": "https://x.com/..."}
      ]
    },
    {
      "main": "Market-wide risk-off as macro headwinds intensify: BTC $93k (*-2.2%*), ETH $3.2k (*-3.3%*)",
      "subPoints": [
        {"text": "Fed minutes reveal hawkish tilt on rate cuts", "sourceUrl": "https://x.com/..."},
        {"text": "Tariff escalation driving flight to safety"}
      ]
    },
    {
      "main": "Altcoin weakness accelerating with SOL leading losses at *-6.1%*"
    }
  ],
  "conclusion": "Leaning bearish short-term (1-2 weeks) as macro uncertainty dominates; watching FOMC meeting on Jan 29 for potential sentiment shift."
}

CONCLUSION REQUIREMENTS:
- State your bias: bullish, bearish, or neutral
- Explain WHY in one phrase
- Include timeframe (e.g., "short-term", "next 1-2 weeks")
- Mention the key event/milestone you're watching that could change your view
- Keep it to 1-2 sentences max, conversational tone

QUALITY CHECKLIST:
- Does each main point have an ANALYTICAL frame (not just "price went down")?
- Are you explaining the narrative/theme driving the market?
- Are you connecting events to price action where intel supports it?
- Use exact prices/percentages from the price data
- If a reason has a [SOURCE: url] in the intel, include it as sourceUrl
- If no reason is known, omit the subPoints field entirely

CRITICAL THINKING CHECKLIST (for EVERY claim):
- Can you explain HOW this causes buying/selling pressure?
- Is this correlation or actual causation?
- Would a skeptical trader find this reasoning convincing?
- Avoid vague "on-chain activity" claims unless you explain the price mechanism

GOOD main points (clear price mechanism):
✓ "ETF inflows creating $1.2B of direct buying pressure" (mechanism: actual purchases)
✓ "Fed rate cut expectations driving risk-on flows into crypto" (mechanism: cheaper capital → risk assets)
✓ "Exchange outflows suggesting reduced sell pressure as holders move to cold storage" (mechanism: less supply on exchanges)
✓ "Token unlock creating supply pressure with 5% of circulating supply entering market" (mechanism: more supply)

BAD main points (vague or no mechanism):
✗ "Network activity surge signals bullishness" (more txs ≠ more buying)
✗ "Active addresses at ATH is bullish" (more users ≠ more buying pressure)
✗ "On-chain metrics looking strong" (vague, no mechanism)
✗ "Whale accumulation detected" (one buys = another sold, often neutral)`;

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

  // Parse the JSON object from the response (new format with bullets and conclusion)
  const jsonMatch = textContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse WhatsUp response");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Handle both old format (array) and new format (object with bullets/conclusion)
  const rawBullets = Array.isArray(parsed) ? parsed : (parsed.bullets || []);
  const conclusion = typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed.conclusion || "") : "";

  interface RawBullet {
    main: string;
    sourceUrl?: string;
    subPoints?: (string | SubPoint)[];
  }

  const bullets: BulletPoint[] = rawBullets.map((b: string | RawBullet) => {
    if (typeof b === 'string') {
      return { main: b };
    }
    // Normalize subPoints if they exist
    const result: BulletPoint = { main: b.main };
    if (b.sourceUrl) {
      result.sourceUrl = b.sourceUrl;
    }
    if (b.subPoints && b.subPoints.length > 0) {
      result.subPoints = b.subPoints.map((sp: string | SubPoint) => {
        if (typeof sp === 'string') {
          return { text: sp };
        }
        return sp;
      });
    }
    return result;
  });

  return {
    bullets,
    conclusion,
    sentiment,
    topMovers: { gainers, losers }
  };
}

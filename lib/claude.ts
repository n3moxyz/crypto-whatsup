import { CoinData, formatPriceData, getMarketSummary } from "./coingecko";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

export async function generateReport(
  coins: CoinData[],
  sampleReports: string[],
  mostRecentReport: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const priceData = formatPriceData(coins);
  const summary = getMarketSummary(coins);

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const systemPrompt = `You are a crypto market analyst writing weekly updates. Your writing style is direct, data-driven, and objective. You use bullet points heavily and avoid hype or sensationalism.

Here are examples of past reports to match the tone and style:
${sampleReports.map((sample, i) => `--- Sample ${i + 1} ---\n${sample}\n`).join("\n")}

IMPORTANT RULES:
- Follow the EXACT 4-part structure specified
- Be concise - one-liners where requested
- Be objective but give a clear stance (bullish/bearish/neutral)
- Only recommend tokens if there's a SPECIFIC, justified reason. If none, say "No specific altcoin calls this week."
- Use your knowledge of the economic calendar to identify upcoming macro events`;

  const userPrompt = `Write a market update for ${dateStr} following this EXACT structure:

CURRENT PRICES:
${priceData}
Market data: BTC 24h change: ${summary.btcChange24h >= 0 ? "+" : ""}${summary.btcChange24h.toFixed(2)}% | ETH 24h change: ${summary.ethChange24h >= 0 ? "+" : ""}${summary.ethChange24h.toFixed(2)}% | SOL 24h change: ${summary.solChange24h >= 0 ? "+" : ""}${summary.solChange24h.toFixed(2)}%

PREVIOUS UPDATE (reference this in Part 1):
${mostRecentReport}

---

Write the report with these 4 parts:

**1) Where we last left off**
- Briefly recap the key points from the previous update above
- What was the stance/outlook then?
- 2-3 bullet points max

**2) Current state of the market**
- BTC: current price + ONE sentence explaining why it's trading at this level
- ETH: current price + ONE sentence explaining why it's trading at this level
- SOL: current price + ONE sentence explaining why it's trading at this level
- End with a clear stance: Are we leaning BULLISH, BEARISH, or NEUTRAL this week? What can readers expect?

**3) Macro background**
- List any notable upcoming macro events in the next 1-2 weeks (CPI, FOMC, jobs data, etc.)
- For each event: ONE sentence on expected impact on crypto (clearly state if good or bad)
- If no major events, say so

**4) Outlook and conclusion**
- 2-4 bullet points on where the market is headed
- Any tokens worth watching? ONLY mention if there's a specific catalyst or reason. If nothing stands out, explicitly say "No specific altcoin calls this week - focus remains on majors."
- Don't force recommendations

Use bullet points. Be direct. Match the writing style from the samples.`;

  const response = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
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

  return data.content[0].text;
}

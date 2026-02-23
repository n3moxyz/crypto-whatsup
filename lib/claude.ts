import { CoinData, formatPriceData, getMarketSummary } from "./coingecko";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

// Retry configuration for overloaded errors
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 2000;

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, options);

    // If success or non-retryable error, return immediately
    if (response.ok || (response.status !== 429 && response.status !== 529)) {
      return response;
    }

    // Retryable error (rate limit or overloaded)
    lastError = new Error(`API overloaded (${response.status})`);

    if (attempt < retries) {
      const delay = INITIAL_DELAY_MS * Math.pow(2, attempt); // Exponential backoff
      console.log(`Claude API overloaded, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

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
  const dateStr = today.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const systemPrompt = `You are a crypto market analyst writing weekly updates. Your writing style is direct, data-driven, and objective. Avoid hype or sensationalism.

Here are examples of past reports to match the tone and style:
${sampleReports.map((sample, i) => `--- Sample ${i + 1} ---\n${sample}\n`).join("\n")}

IMPORTANT RULES:
- Match the EXACT formatting style from the samples above
- Be concise - one-liners where requested
- Be objective but give a clear stance (bullish/bearish/neutral)
- Only recommend tokens if there's a SPECIFIC, justified reason. If none, say "No specific altcoin calls this week."
- Use your knowledge of the economic calendar to identify upcoming macro events
- Do NOT use bullet point characters (-, •, *, etc.) - just write each point on its own line without any prefix`;

  const userPrompt = `Write a market update for ${dateStr}.

CURRENT PRICES (for your reference only):
${priceData}
Market data: BTC 24h change: ${summary.btcChange24h >= 0 ? "+" : ""}${summary.btcChange24h.toFixed(2)}% | ETH 24h change: ${summary.ethChange24h >= 0 ? "+" : ""}${summary.ethChange24h.toFixed(2)}% | SOL 24h change: ${summary.solChange24h >= 0 ? "+" : ""}${summary.solChange24h.toFixed(2)}%

PREVIOUS UPDATE (reference this in Part 1):
${mostRecentReport}

---

Start with this EXACT header:
*Markets update (${dateStr})* #liquid #macro

Then write the report with these sections (wrap section headers in single asterisks):

*1) Where we left off*
Briefly recap the key points from the previous update above.
What was the stance/outlook then?
2-3 lines max, each on its own line.

*2) Current state of the market*
BTC: current price + ONE sentence explaining why it's trading at this level.
ETH: current price + ONE sentence explaining why it's trading at this level.
SOL: current price + ONE sentence explaining why it's trading at this level.
You can add sub-sections like "Good signs" and "Caveats" if relevant.
End with a clear stance.

*3) Macro background*
List any notable upcoming macro events in the next 1-2 weeks (CPI, FOMC, jobs data, etc.).
For each event: ONE sentence on expected impact on crypto.
If no major events, say so.

*4) Outlook and conclusion*
2-4 lines on where the market is headed.
Any tokens worth watching? ONLY mention if there's a specific catalyst.

CRITICAL FORMATTING:
- Header: "*Markets update (${dateStr})* #liquid #macro"
- Section headers wrapped in single asterisks: "*1) Where we left off*"
- Each point goes on its own line WITHOUT any bullet characters (no •, -, or *)
- Match the exact style from the sample reports`;

  const response = await fetchWithRetry(ANTHROPIC_API, {
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

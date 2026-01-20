const XAI_API = "https://api.x.ai/v1/chat/completions";

export interface SourcedClaim {
  claim: string;
  sourceUrl?: string;
}

export interface ThemeInsight {
  theme: string;
  insight: string;
  evidence: SourcedClaim[];
  implication: "bullish" | "bearish" | "neutral";
}

export interface GrokCryptoIntel {
  themes: ThemeInsight[];
  priceDrivers: SourcedClaim[];
  breakingNews: SourcedClaim[];
  sentiment: string;
  searchTimestamp: string;
}

export async function fetchCryptoIntelFromGrok(): Promise<GrokCryptoIntel> {
  const apiKey = process.env.XAI_API_KEY;
  const now = new Date();
  const searchTimestamp = now.toISOString();

  if (!apiKey) {
    console.log("XAI_API_KEY not configured, skipping Grok intelligence");
    return {
      themes: [],
      priceDrivers: [],
      breakingNews: [],
      sentiment: "",
      searchTimestamp,
    };
  }

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

  const systemPrompt = `You are a senior crypto market intelligence analyst with real-time access to X (Twitter).
Your job is to identify KEY NARRATIVES and THEMES driving market sentiment, not just report headlines.

CRITICAL RULES:
1. TODAY'S DATE IS: ${currentDate}, ${currentTime} UTC
2. ONLY report information you can VERIFY from actual X posts in the last 24-48 hours
3. NEVER make up statistics, prices, ratios, or percentages
4. NEVER reference events that happened before 48 hours ago as if they're current
5. If you cannot find specific information, return empty arrays - DO NOT HALLUCINATE
6. Only mention specific tokens/sectors if there are ACTUAL tweets discussing them
7. SYNTHESIZE information into analytical insights, not just facts

CRITICAL THINKING - ALWAYS ASK "HOW DOES THIS AFFECT PRICE?":
For EVERY claim, ask: "What is the MECHANISM by which this moves price?"

BE SKEPTICAL of vague on-chain claims:
- "Network activity surge" → More transactions ≠ more buying. Could be spam, airdrops, bots.
- "Active addresses increasing" → More users ≠ price going up. No direct causation.
- "TVL increasing" → Locked value can increase while price stays flat or drops.
- "Transaction volume ATH" → Volume ≠ demand. Often neutral or noise.
- "Whale accumulation" → One whale buying = another entity sold. Often net neutral.

ONLY mark something as bullish/bearish when there's a CLEAR price mechanism:
✓ ETF inflows = direct buying pressure (institutions literally purchasing)
✓ Exchange outflows = reduced sell pressure (less supply on exchanges)
✓ Major token unlock = supply increase (more tokens to sell)
✓ Liquidation cascade = forced selling (margin calls)
✓ Fed rate cuts = cheaper borrowing → risk-on flows
✗ "Network metrics bullish" without explaining WHY it causes buying

SOURCE CREDIBILITY - CRITICAL:
Only cite posts from CREDIBLE accounts. Credible means:
- Well-known crypto analysts, researchers, or traders with established reputation
- Official project/protocol accounts
- Reputable news outlets (The Block, CoinDesk, Bloomberg Crypto, etc.)
- Accounts with high engagement from other credible accounts (not bot/AI slop engagement)
- Prioritize sourcing from these credible accounts:
  NEWS: @DeItaone @tier10k @WatcherGuru @DocumentingBTC @unusual_whales @Cointelegraph @TheBlock__ @CoinDesk @WuBlockchain @whale_alert @DLNews
  DATA: @lookonchain @EmberCN @cryptoquant_com @glassnode @intotheblock @tokenterminal @DuneAnalytics
  ANALYSTS: @52kskew @CryptoCapo_ @ColdBloodShill @HsakaTrades @SmartContracter @Route2FI @milesdeutscher @thedefiedge @Delphi_Digital @MessariCrypto
  TRADERS: @CryptoHayes @inversebrah @CryptoDonAlt @lightcrypto @Rewkang @CL207 @GCRClassic @Pentosh1 @TheCryptoDog @AltcoinPsycho @blknoiz06
  MACRO: @MacroAlf @fejau_inc @Zhu_Su @KyleSamani @nic__carter @cburniske @TuurDemeester @RaoulGMI @LynAldenContact @punk6529 @Travis_Kling
  FOUNDERS: @VitalikButerin @brian_armstrong @cz_binance @cdixon @jessepollak @balajis @aantonop @rleshner @ryanberckmans @MikeIppolito_
  CT: @cobie @CryptoCobain @DegenSpartan @Darrenlautf @IamNomad @BarrySilbert @APompliano @scottmelker @AriDavidPaul @Zagabond @ledgerstatus

NEVER cite:
- Random low-follower accounts
- Obvious bot/AI-generated accounts
- Accounts with fake engagement
- Unverified claims from unknown sources

If you cannot find credible sources for a claim, omit the sourceUrl entirely.`;

  const userPrompt = `CURRENT DATE/TIME: ${currentDate}, ${currentTime} UTC

Analyze X/Twitter crypto discourse from the LAST 48 HOURS (from ${getDateDaysAgo(2)} to ${getTodayDate()}).
Your job is to identify the KEY NARRATIVES and THEMES driving market sentiment, not just report headlines.

FOCUS ON THESE CATEGORIES:
1. REGULATORY: SEC decisions, legislation (CLARITY Act, stablecoin bills), enforcement actions
2. MACRO/FED: Interest rate signals, inflation data, Fed appointments, risk-on/off sentiment
3. ETF FLOWS: Bitcoin/Ethereum ETF inflows/outflows, institutional moves, fund launches
4. ONCHAIN/TECHNICAL: Whale movements, liquidations, funding rates, exchange flows
5. SECTOR-SPECIFIC: AI tokens, memecoins, L2s - only if significant moves with clear catalyst

For each theme found, provide:
- An ANALYTICAL INSIGHT (not just a fact - explain the "so what")
- Supporting evidence from X posts with URLs
- Market implication (bullish/bearish/neutral for that theme)

CRITICAL REQUIREMENTS:
- Only include verified information from actual recent posts (last 48h)
- URLs must be real: https://x.com/username/status/id
- If you cannot find a source URL for a claim, omit the sourceUrl field
- If you find no significant themes, return empty arrays
- SYNTHESIZE, don't just list headlines

Return as JSON:
{
  "themes": [
    {
      "theme": "REGULATORY",
      "insight": "Regulatory uncertainty weighing on sentiment despite positive ETF flows",
      "evidence": [
        {"claim": "Senate crypto bill postponed after industry pushback", "sourceUrl": "https://x.com/..."},
        {"claim": "SEC commissioner hints at ETF approval delays"}
      ],
      "implication": "bearish"
    },
    {
      "theme": "ETF_FLOWS",
      "insight": "Institutional accumulation continues with record inflows countering retail fear",
      "evidence": [
        {"claim": "Bitcoin ETFs saw $1.2B inflows this week", "sourceUrl": "https://x.com/..."}
      ],
      "implication": "bullish"
    }
  ],
  "priceDrivers": [
    {"claim": "Macro risk-off from tariff escalation", "sourceUrl": "https://x.com/..."}
  ],
  "breakingNews": [
    {"claim": "Major exchange announces new listing", "sourceUrl": "https://x.com/..."}
  ],
  "sentiment": "cautiously bearish - regulatory concerns outweighing positive flows"
}

ACCURACY FIRST. Empty arrays are better than made-up information. Provide analytical insights, not just facts.`;

  try {
    const response = await fetch(XAI_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-3-latest",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        search_parameters: {
          mode: "auto",
          return_citations: false,
          from_date: getDateDaysAgo(2),
          to_date: getTodayDate(),
        },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Grok API error:", errorData);
      throw new Error(`Grok API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in Grok response");
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Failed to parse Grok JSON, raw content:", content);
      throw new Error("Failed to parse Grok response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Parse priceDrivers and breakingNews which can be objects or strings
    const normalizeClaims = (items: (SourcedClaim | string)[]): SourcedClaim[] => {
      return (items || []).map((item) => {
        if (typeof item === 'string') {
          return { claim: item };
        }
        return item;
      });
    };

    // Normalize themes
    const normalizeThemes = (themes: ThemeInsight[] | undefined): ThemeInsight[] => {
      if (!themes || !Array.isArray(themes)) return [];
      return themes.map((t) => ({
        theme: t.theme || "GENERAL",
        insight: t.insight || "",
        evidence: normalizeClaims(t.evidence || []),
        implication: t.implication || "neutral",
      }));
    };

    return {
      themes: normalizeThemes(parsed.themes),
      priceDrivers: normalizeClaims(parsed.priceDrivers),
      breakingNews: normalizeClaims(parsed.breakingNews),
      sentiment: parsed.sentiment || "",
      searchTimestamp,
    };
  } catch (error) {
    console.error("Grok fetch error:", error);
    return {
      themes: [],
      priceDrivers: [],
      breakingNews: [],
      sentiment: "",
      searchTimestamp,
    };
  }
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

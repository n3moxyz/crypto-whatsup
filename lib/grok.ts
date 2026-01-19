const XAI_API = "https://api.x.ai/v1/chat/completions";

export interface GrokCryptoIntel {
  narratives: string[];
  breakingNews: string[];
  sentiment: string;
  keyTweets: string[];
  searchTimestamp: string;
}

export async function fetchCryptoIntelFromGrok(): Promise<GrokCryptoIntel> {
  const apiKey = process.env.XAI_API_KEY;
  const now = new Date();
  const searchTimestamp = now.toISOString();

  if (!apiKey) {
    console.log("XAI_API_KEY not configured, skipping Grok intelligence");
    return {
      narratives: [],
      breakingNews: [],
      sentiment: "",
      keyTweets: [],
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

  const systemPrompt = `You are a crypto market intelligence analyst with real-time access to X (Twitter).

CRITICAL RULES:
1. TODAY'S DATE IS: ${currentDate}, ${currentTime} UTC
2. ONLY report information you can VERIFY from actual X posts in the last 24-48 hours
3. NEVER make up statistics, prices, ratios, or percentages
4. NEVER reference events that happened before 48 hours ago as if they're current
5. If you cannot find specific information, say "No significant news found" - DO NOT HALLUCINATE
6. Only mention specific tokens/sectors if there are ACTUAL tweets discussing notable price moves or news about them
7. Do not mention past events (like "December rate cut") as future probabilities`;

  const userPrompt = `CURRENT DATE/TIME: ${currentDate}, ${currentTime} UTC

Search X/Twitter for VERIFIED crypto market developments from the LAST 24-48 HOURS ONLY (from ${getDateDaysAgo(2)} to ${getTodayDate()}).

STRICT REQUIREMENTS:
- Only include information you can verify from actual recent posts
- If you find no significant news for a category, return an empty array for that category
- Do not speculate or assume - only report what's actually being discussed
- Include the approximate time/date if known (e.g., "yesterday", "12 hours ago")

Return as JSON:
{
  "breakingNews": ["verified news with source context if possible..."] or [],
  "narratives": ["what specific tokens people are discussing with real context..."] or [],
  "keyTweets": ["actual insights being shared, not made up..."] or [],
  "sentiment": "brief factual summary of CT mood, or 'mixed/unclear' if no strong signal"
}

REMEMBER: Empty arrays are better than hallucinated information. Accuracy over detail.`;

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

    return {
      narratives: parsed.narratives || [],
      breakingNews: parsed.breakingNews || [],
      sentiment: parsed.sentiment || "",
      keyTweets: parsed.keyTweets || [],
      searchTimestamp,
    };
  } catch (error) {
    console.error("Grok fetch error:", error);
    return {
      narratives: [],
      breakingNews: [],
      sentiment: "",
      keyTweets: [],
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

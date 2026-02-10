export interface SentimentEntry {
  timestamp: string;
  sentiment: "bullish" | "bearish" | "neutral";
  conclusion: string;
}

const STORAGE_KEY = "sentimentHistory";
const MAX_ENTRIES = 30;

// Extract sentiment from conclusion text - moved from WhatsUpDisplay.tsx
export function deriveSentimentFromConclusion(
  conclusion: string | undefined,
  fallbackSentiment: "bullish" | "bearish" | "neutral"
): "bullish" | "bearish" | "neutral" {
  if (!conclusion) return fallbackSentiment;
  const conclusionLower = conclusion.toLowerCase();

  // Check for explicit bearish indicators
  if (
    conclusionLower.includes("leaning bearish") ||
    conclusionLower.includes("bearish short") ||
    conclusionLower.includes("bearish medium") ||
    conclusionLower.includes("bearish long") ||
    conclusionLower.includes("strongly bearish") ||
    (conclusionLower.includes("bearish") && !conclusionLower.includes("not bearish"))
  ) {
    return "bearish";
  }

  // Check for explicit bullish indicators
  if (
    conclusionLower.includes("leaning bullish") ||
    conclusionLower.includes("bullish short") ||
    conclusionLower.includes("bullish medium") ||
    conclusionLower.includes("bullish long") ||
    conclusionLower.includes("strongly bullish") ||
    (conclusionLower.includes("bullish") && !conclusionLower.includes("not bullish"))
  ) {
    return "bullish";
  }

  return "neutral";
}

export function getSentimentHistory(): SentimentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SentimentEntry[];
  } catch {
    return [];
  }
}

export function addSentimentEntry(entry: SentimentEntry): void {
  if (typeof window === "undefined") return;
  try {
    const history = getSentimentHistory();

    // Deduplicate same-day entries (keep the latest)
    const entryDate = new Date(entry.timestamp).toDateString();
    const filtered = history.filter(
      (e) => new Date(e.timestamp).toDateString() !== entryDate
    );

    // Add new entry at the beginning
    filtered.unshift(entry);

    // Cap at MAX_ENTRIES
    const capped = filtered.slice(0, MAX_ENTRIES);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
  } catch {
    // Silently fail if localStorage is full or unavailable
  }
}

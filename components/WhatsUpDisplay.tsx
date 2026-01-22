"use client";

import { useState, useEffect, useRef } from "react";

const ESTIMATED_TIME = 45; // Estimated seconds for market summary

// Loading messages that cycle during the countdown
const LOADING_MESSAGES = [
  { text: "Scanning X/Twitter for market chatter...", icon: "🔍" },
  { text: "Analyzing price movements...", icon: "📊" },
  { text: "Reading crypto news feeds...", icon: "📰" },
  { text: "Checking whale activity...", icon: "🐋" },
  { text: "Evaluating market sentiment...", icon: "🎯" },
  { text: "Compiling intelligence report...", icon: "📝" },
  { text: "Almost there, finalizing...", icon: "✨" },
];

// Chat message interface
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  bulletIndex?: number; // If this was triggered by clicking a bullet
}

export interface TopMover {
  symbol: string;
  name: string;
  change: string;
  price: number;
}

export type TopMoverTier = "top50" | "top100" | "top200" | "top300";

export interface TieredTopMovers {
  top50: { gainers: TopMover[]; losers: TopMover[] };
  top100: { gainers: TopMover[]; losers: TopMover[] };
  top200: { gainers: TopMover[]; losers: TopMover[] };
  top300: { gainers: TopMover[]; losers: TopMover[] };
}

export interface SubPoint {
  text: string;
  sourceUrl?: string;
}

export interface BulletPoint {
  main: string;
  sourceUrl?: string;
  subPoints?: (string | SubPoint)[];
}

export interface WhatsUpData {
  bullets: BulletPoint[] | string[];
  conclusion?: string;
  sentiment: "bullish" | "bearish" | "neutral";
  topMovers: TieredTopMovers;
  timestamp: string;
}

interface WhatsUpDisplayProps {
  data: WhatsUpData;
  isLoading: boolean;
}

const TIER_OPTIONS: { value: TopMoverTier; label: string }[] = [
  { value: "top50", label: "Top 50" },
  { value: "top100", label: "Top 100" },
  { value: "top200", label: "Top 200" },
  { value: "top300", label: "Top 300" },
];

// Helper to format text with crypto prices (purple) - ONLY when preceded by ticker
const formatText = (text: string) => {
  let formatted = text;

  // Color crypto token prices in purple ONLY when directly preceded by a ticker symbol
  // Matches: "BTC $89k", "ETH $3.2k", "SOL $240", "BTC: $89k", "BTC at $89k"
  // Does NOT match: "$891k inflows", "$10 billion", "absorbed $345M"
  const tickerPattern = /\b(BTC|ETH|SOL|BNB|XRP|ADA|DOGE|DOT|MATIC|AVAX|LINK|UNI|ATOM|LTC|BCH|XLM|ALGO|VET|FIL|THETA|ICP|TRX|ETC|XMR|AAVE|GRT|MKR|SNX|COMP|YFI|SUSHI|CRV|BAL|REN|KNC|LRC|ZRX|ENJ|MANA|SAND|AXS|CHZ|GALA|IMX|APE|OP|ARB|BLUR|PEPE|WLD|SUI|SEI|TIA|JUP|STRK|PENDLE|Bitcoin|Ethereum|Solana)(?:\s*[:@]?\s*|\s+at\s+)(\$[\d,.]+k?)\b/gi;

  formatted = formatted.replace(tickerPattern, (match, ticker, price) => {
    return `${ticker} <span style="color: #a78bfa; font-weight: 500;">${price}</span>`;
  });

  // Handle *italic* markers - just remove the asterisks and keep the text
  formatted = formatted.replace(
    /\*([^*]+)\*/g,
    '$1'
  );

  return formatted;
};

// Normalize bullets to always be BulletPoint[]
const normalizeBullets = (bullets: BulletPoint[] | string[]): BulletPoint[] => {
  return bullets.map(b => {
    if (typeof b === 'string') {
      return { main: b };
    }
    return b;
  });
};

// Normalize sub-points to extract text and sourceUrl
const normalizeSubPoint = (sub: string | SubPoint): { text: string; sourceUrl?: string } => {
  if (typeof sub === 'string') {
    return { text: sub };
  }
  return sub;
};

export default function WhatsUpDisplay({ data, isLoading }: WhatsUpDisplayProps) {
  const [selectedTier, setSelectedTier] = useState<TopMoverTier>("top100");
  const [timeRemaining, setTimeRemaining] = useState(ESTIMATED_TIME);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Interactive follow-up state
  const [preloadedElaborations, setPreloadedElaborations] = useState<Record<number, string>>({});
  const [expandedBullets, setExpandedBullets] = useState<Set<number>>(new Set());
  const [isPreloading, setIsPreloading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Reset and start timer when loading begins
  useEffect(() => {
    if (isLoading) {
      setTimeRemaining(ESTIMATED_TIME);
      setStartTime(Date.now());
    } else {
      setStartTime(null);
    }
  }, [isLoading]);

  // Countdown timer
  useEffect(() => {
    if (!isLoading || !startTime) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, ESTIMATED_TIME - elapsed);
      setTimeRemaining(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoading, startTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  const progress = ((ESTIMATED_TIME - timeRemaining) / ESTIMATED_TIME) * 100;

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Pre-load all bullet elaborations when data loads
  useEffect(() => {
    if (isLoading || !data.bullets || data.bullets.length === 0) return;

    const bullets = normalizeBullets(data.bullets);
    setIsPreloading(true);

    // Fetch elaborations for all bullets in parallel
    const fetchAllElaborations = async () => {
      const promises = bullets.map(async (bullet, index) => {
        try {
          const response = await fetch("/api/whatsup/followup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: `Tell me more about this point: "${bullet.main}"`,
              context: {
                bullets,
                conclusion: data.conclusion,
                sentiment: data.sentiment,
              },
              bulletIndex: index,
            }),
          });

          if (!response.ok) throw new Error("Failed to get elaboration");

          const result = await response.json();
          return { index, answer: result.answer };
        } catch (error) {
          console.error(`Error preloading bullet ${index}:`, error);
          return { index, answer: "Unable to load additional details." };
        }
      });

      const results = await Promise.all(promises);
      const elaborations: Record<number, string> = {};
      results.forEach(({ index, answer }) => {
        elaborations[index] = answer;
      });

      setPreloadedElaborations(elaborations);
      setIsPreloading(false);
    };

    fetchAllElaborations();
  }, [isLoading, data.bullets, data.conclusion, data.sentiment]);

  // Handle clicking on a bullet to expand/collapse it (no loading - already preloaded)
  const handleBulletClick = (bulletIndex: number) => {
    setExpandedBullets(prev => {
      const next = new Set(prev);
      if (next.has(bulletIndex)) {
        next.delete(bulletIndex);
      } else {
        next.add(bulletIndex);
      }
      return next;
    });
  };

  // Handle chat submission
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage: ChatMessage = { role: "user", content: chatInput.trim() };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const response = await fetch("/api/whatsup/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMessage.content,
          context: {
            bullets: normalizeBullets(data.bullets),
            conclusion: data.conclusion,
            sentiment: data.sentiment,
          },
          conversationHistory: chatMessages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const result = await response.json();
      setChatMessages(prev => [...prev, { role: "assistant", content: result.answer }]);
    } catch (error) {
      console.error("Error in chat:", error);
      setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't process that. Please try again." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    if (price >= 1000) return `$${(price / 1000).toFixed(1)}k`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    return `$${price.toFixed(4)}`;
  };

  const bullets = normalizeBullets(data.bullets);

  // Get current loading message based on progress
  const getLoadingMessage = () => {
    const messageIndex = Math.min(
      Math.floor((progress / 100) * LOADING_MESSAGES.length),
      LOADING_MESSAGES.length - 1
    );
    return LOADING_MESSAGES[messageIndex];
  };

  if (isLoading) {
    const currentMessage = getLoadingMessage();

    return (
      <div className="card p-6">
        <div className="flex flex-col items-center justify-center py-8">
          {/* Animated icon */}
          <div
            className="text-4xl mb-4 animate-bounce"
            style={{ animationDuration: "1.5s" }}
          >
            {currentMessage.icon}
          </div>

          {/* Progress bar */}
          <div
            className="w-48 h-1.5 rounded-full mb-4 overflow-hidden"
            style={{ backgroundColor: "var(--bg-tertiary)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, var(--accent), #a78bfa)",
              }}
            />
          </div>

          {/* Time remaining */}
          <div className="flex items-center gap-2 mb-3">
            <span
              className="text-primary font-mono font-semibold"
              style={{ fontSize: "var(--text-2xl)" }}
            >
              {timeRemaining > 0 ? formatTime(timeRemaining) : "..."}
            </span>
            <span className="text-muted" style={{ fontSize: "var(--text-xs)" }}>
              remaining
            </span>
          </div>

          {/* Dynamic status message */}
          <p
            className="text-secondary text-center transition-opacity duration-300"
            style={{ fontSize: "var(--text-sm)", minHeight: "1.5rem" }}
          >
            {currentMessage.text}
          </p>

          {/* Subtle pulsing dots */}
          <div className="flex gap-1 mt-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{
                  backgroundColor: "var(--accent)",
                  animationDelay: `${i * 0.2}s`,
                  opacity: 0.6,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const sentimentConfig = {
    bullish: { className: "pill-up", label: "Bullish" },
    bearish: { className: "pill-down", label: "Bearish" },
    neutral: { className: "pill-neutral", label: "Neutral" },
  };

  // Derive sentiment from conclusion text if available (more accurate than API sentiment)
  const deriveSentimentFromConclusion = (): "bullish" | "bearish" | "neutral" => {
    if (!data.conclusion) return data.sentiment;
    const conclusionLower = data.conclusion.toLowerCase();

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
  };

  const derivedSentiment = deriveSentimentFromConclusion();
  const sentiment = sentimentConfig[derivedSentiment] || sentimentConfig.neutral;

  return (
    <div className="card p-5">
      {/* Header with sentiment */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-secondary font-medium" style={{ fontSize: "var(--text-base)" }}>
          24-48h Market Overview
        </span>
        <span className={`pill ${sentiment.className}`}>
          {sentiment.label}
        </span>
      </div>

      {/* Bullet Points with Sub-points */}
      <div className="data-cell mb-5">
        <ul className="space-y-3">
          {bullets.map((bullet, index) => {
            const isExpanded = expandedBullets.has(index);
            const elaboration = preloadedElaborations[index];
            const hasElaboration = !!elaboration;

            return (
              <li key={index}>
                {/* Main bullet text */}
                <div
                  className="flex gap-3 text-primary"
                  style={{ fontSize: "var(--text-base)", lineHeight: 1.6 }}
                >
                  <span className="text-accent flex-shrink-0" style={{ lineHeight: 1.6 }}>•</span>
                  <span>
                    <span dangerouslySetInnerHTML={{ __html: formatText(bullet.main) }} />
                    {bullet.sourceUrl && (
                      <a
                        href={bullet.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline ml-1"
                        style={{ fontSize: "var(--text-sm)" }}
                      >
                        (Source)
                      </a>
                    )}
                  </span>
                </div>

                {/* Sub-points (always visible) */}
                {bullet.subPoints && bullet.subPoints.length > 0 && (
                  <ul className="ml-6 mt-1.5 space-y-1">
                    {bullet.subPoints.map((sub, subIndex) => {
                      const { text, sourceUrl } = normalizeSubPoint(sub);
                      return (
                        <li
                          key={subIndex}
                          className="flex gap-2 text-secondary"
                          style={{ fontSize: "var(--text-sm)", lineHeight: 1.5 }}
                        >
                          <span className="text-muted flex-shrink-0" style={{ lineHeight: 1.5 }}>→</span>
                          <span>
                            <span dangerouslySetInnerHTML={{ __html: formatText(text) }} />
                            {sourceUrl && (
                              <a
                                href={sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accent hover:underline ml-1"
                                style={{ fontSize: "var(--text-xs)" }}
                              >
                                (Source)
                              </a>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Expand button - subtle, integrated, and italic */}
                <button
                  onClick={() => handleBulletClick(index)}
                  className="ml-6 mt-2 flex items-center gap-1.5 transition-all duration-200 italic"
                  style={{
                    fontSize: "var(--text-xs)",
                    color: isExpanded ? "var(--accent)" : "var(--text-muted)",
                    opacity: isPreloading && !hasElaboration ? 0.5 : 1,
                  }}
                  disabled={isPreloading && !hasElaboration}
                >
                  <span
                    className="transition-transform duration-200 inline-block not-italic"
                    style={{
                      transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                      fontSize: "8px",
                    }}
                  >
                    ●
                  </span>
                  <span className="hover:underline">
                    {isPreloading && !hasElaboration
                      ? "Loading details..."
                      : isExpanded
                      ? "Show less"
                      : "Tell me more"}
                  </span>
                </button>

                {/* Expanded elaboration (appears after sub-bullets) - italic */}
                {isExpanded && hasElaboration && (
                  <div
                    className="ml-6 mt-2 p-3 rounded-lg text-secondary italic"
                    style={{
                      fontSize: "var(--text-sm)",
                      lineHeight: 1.6,
                      backgroundColor: "var(--bg-tertiary)",
                      borderLeft: "2px solid var(--accent)",
                    }}
                  >
                    {elaboration}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Conclusion */}
      {data.conclusion && (
        <div
          className="mb-5 p-3 rounded-lg"
          style={{
            backgroundColor: "var(--bg-tertiary)",
            borderLeft: "3px solid var(--accent)",
          }}
        >
          <p
            className="text-secondary"
            style={{ fontSize: "var(--text-sm)", lineHeight: 1.6 }}
          >
            <span className="text-primary font-semibold">Bias: </span>
            <span className="italic" dangerouslySetInnerHTML={{ __html: formatText(data.conclusion) }} />
          </p>
        </div>
      )}

      {/* Follow-up Chat Section - After Bias, Before Top Movers */}
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-secondary font-medium" style={{ fontSize: "var(--text-sm)" }}>
            Ask a follow-up question
          </span>
          {chatMessages.length > 0 && (
            <button
              onClick={() => setChatMessages([])}
              className="text-muted hover:text-secondary transition-colors"
              style={{ fontSize: "var(--text-xs)" }}
            >
              Clear chat
            </button>
          )}
        </div>

        {/* Chat Messages - Conversation style */}
        {chatMessages.length > 0 && (
          <div
            className="mb-3 space-y-4 max-h-80 overflow-y-auto rounded-lg p-4"
            style={{ backgroundColor: "var(--bg-secondary)" }}
          >
            {chatMessages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[85%]"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  {/* Message bubble */}
                  <div
                    className="rounded-2xl px-4 py-3"
                    style={{
                      fontSize: "var(--text-sm)",
                      lineHeight: 1.7,
                      backgroundColor: msg.role === "user" ? "var(--accent)" : "#2d3748",
                      color: msg.role === "user" ? "white" : "var(--text-primary)",
                      borderBottomRightRadius: msg.role === "user" ? "4px" : "18px",
                      borderBottomLeftRadius: msg.role === "user" ? "18px" : "4px",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="flex justify-start">
                <div
                  className="max-w-[85%]"
                  style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}
                >
                  <div
                    className="rounded-2xl px-4 py-3"
                    style={{
                      fontSize: "var(--text-sm)",
                      backgroundColor: "#2d3748",
                      color: "var(--text-muted)",
                      borderBottomLeftRadius: "4px",
                    }}
                  >
                    <span className="animate-pulse">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}

        {/* Chat Input */}
        <form onSubmit={handleChatSubmit} className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="e.g. Why is sentiment bearish? What's driving BTC?"
            disabled={isChatLoading}
            className="flex-1 rounded-lg px-3 py-2 text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={{
              fontSize: "var(--text-sm)",
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
            }}
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || isChatLoading}
            className="px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
            style={{
              fontSize: "var(--text-sm)",
              backgroundColor: "var(--accent)",
              color: "white",
            }}
          >
            Ask
          </button>
        </form>

        {/* Suggested Questions */}
        {chatMessages.length === 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              "Why this sentiment?",
              "What to watch for?",
              "Explain the macro",
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setChatInput(suggestion)}
                className="px-2 py-1 rounded-md text-muted hover:text-secondary hover:bg-[var(--bg-secondary)] transition-colors"
                style={{ fontSize: "var(--text-xs)", border: "1px solid var(--border-color)" }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Top Movers - Improved Layout */}
      <div className="mb-4">
        {/* Tier Toggle */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-muted" style={{ fontSize: "var(--text-xs)" }}>Show movers from:</span>
          <div className="flex gap-1">
            {TIER_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedTier(option.value)}
                className={`px-2 py-1 rounded transition-colors ${
                  selectedTier === option.value
                    ? "bg-[var(--accent)] text-white"
                    : "bg-tertiary text-secondary hover:bg-hover"
                }`}
                style={{ fontSize: "var(--text-xs)" }}
                aria-label={`Show movers from ${option.label}`}
                aria-pressed={selectedTier === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Gainers */}
        <div
          className="rounded-lg p-4"
          style={{ backgroundColor: "var(--success-bg)", border: "1px solid var(--success)" }}
        >
          <div className="mb-3" style={{ fontSize: "var(--text-xs)", color: "var(--success)", fontWeight: 700, letterSpacing: "0.05em" }}>
            TOP GAINERS (24H)
          </div>
          <div className="space-y-2.5">
            {(data.topMovers[selectedTier]?.gainers || []).slice(0, 5).map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-muted" style={{ fontSize: "var(--text-xs)", width: "16px" }}>
                    {index + 1}.
                  </span>
                  <span className="font-medium" style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                    {item.symbol}
                  </span>
                  <span className="text-muted font-mono" style={{ fontSize: "var(--text-xs)" }}>
                    {formatPrice(item.price)}
                  </span>
                </div>
                <span className="font-mono font-semibold" style={{ fontSize: "var(--text-sm)", color: "var(--success)" }}>
                  {item.change}
                </span>
              </div>
            ))}
            {(data.topMovers[selectedTier]?.gainers || []).length === 0 && (
              <span className="text-muted" style={{ fontSize: "var(--text-xs)" }}>No gainers</span>
            )}
          </div>
        </div>

        {/* Losers */}
        <div
          className="rounded-lg p-4"
          style={{ backgroundColor: "var(--danger-bg)", border: "1px solid var(--danger)" }}
        >
          <div className="mb-3" style={{ fontSize: "var(--text-xs)", color: "var(--danger)", fontWeight: 700, letterSpacing: "0.05em" }}>
            TOP LOSERS (24H)
          </div>
          <div className="space-y-2.5">
            {(data.topMovers[selectedTier]?.losers || []).slice(0, 5).map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-muted" style={{ fontSize: "var(--text-xs)", width: "16px" }}>
                    {index + 1}.
                  </span>
                  <span className="font-medium" style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                    {item.symbol}
                  </span>
                  <span className="text-muted font-mono" style={{ fontSize: "var(--text-xs)" }}>
                    {formatPrice(item.price)}
                  </span>
                </div>
                <span className="font-mono font-semibold" style={{ fontSize: "var(--text-sm)", color: "var(--danger)" }}>
                  {item.change}
                </span>
              </div>
            ))}
            {(data.topMovers[selectedTier]?.losers || []).length === 0 && (
              <span className="text-muted" style={{ fontSize: "var(--text-xs)" }}>No losers</span>
            )}
          </div>
        </div>
      </div>

      {/* Timestamp */}
      {data.timestamp && (
        <div className="text-muted mt-4 text-right" style={{ fontSize: "var(--text-xs)" }}>
          {new Date(data.timestamp).toLocaleString()}
        </div>
      )}
    </div>
  );
}

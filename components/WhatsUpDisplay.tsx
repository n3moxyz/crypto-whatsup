"use client";

import { useState, useEffect } from "react";

const ESTIMATED_TIME = 30; // Estimated seconds for market summary

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

// Helper to format text with *italic* markers
const formatText = (text: string) => {
  return text.replace(/\*([^*]+)\*/g, '<span class="text-accent font-medium">$1</span>');
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

  const formatPrice = (price: number) => {
    if (price >= 1000) return `$${(price / 1000).toFixed(1)}k`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    return `$${price.toFixed(4)}`;
  };

  const bullets = normalizeBullets(data.bullets);

  if (isLoading) {
    return (
      <div className="card p-6">
        <div className="flex flex-col items-center justify-center py-8">
          {/* Circular progress indicator */}
          <div className="relative mb-4">
            <svg className="w-20 h-20 transform -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="var(--border-color)"
                strokeWidth="4"
                fill="none"
              />
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="var(--accent)"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 36}`}
                strokeDashoffset={`${2 * Math.PI * 36 * (1 - progress / 100)}`}
                style={{ transition: "stroke-dashoffset 0.5s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-primary font-mono font-semibold" style={{ fontSize: "var(--text-lg)" }}>
                {timeRemaining > 0 ? formatTime(timeRemaining) : "..."}
              </span>
            </div>
          </div>
          <p className="text-secondary mb-1" style={{ fontSize: "var(--text-sm)" }}>
            Analyzing market data...
          </p>
          <p className="text-muted" style={{ fontSize: "var(--text-xs)" }}>
            {timeRemaining > 0 ? "Fetching X/Twitter intelligence" : "Almost done, finalizing..."}
          </p>
        </div>
      </div>
    );
  }

  const sentimentConfig = {
    bullish: { className: "pill-up", label: "Bullish" },
    bearish: { className: "pill-down", label: "Bearish" },
    neutral: { className: "pill-neutral", label: "Neutral" },
  };

  const sentiment = sentimentConfig[data.sentiment] || sentimentConfig.neutral;

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
          {bullets.map((bullet, index) => (
            <li key={index}>
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
            </li>
          ))}
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
            <span dangerouslySetInnerHTML={{ __html: formatText(data.conclusion) }} />
          </p>
        </div>
      )}

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

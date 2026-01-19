"use client";

import { useState } from "react";

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

export interface WhatsUpData {
  bullets: string[];
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

export default function WhatsUpDisplay({ data, isLoading }: WhatsUpDisplayProps) {
  const [selectedTier, setSelectedTier] = useState<TopMoverTier>("top100");

  if (isLoading) {
    return (
      <div className="card p-6">
        <div className="flex flex-col items-center justify-center py-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="loading-dot"></span>
            <span className="loading-dot"></span>
            <span className="loading-dot"></span>
          </div>
          <p className="text-secondary" style={{ fontSize: "var(--text-sm)" }}>
            Fetching market data...
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

  const formatPrice = (price: number) => {
    if (price >= 1000) return `$${(price / 1000).toFixed(1)}k`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    return `$${price.toFixed(4)}`;
  };

  return (
    <div className="card p-5">
      {/* Header with sentiment */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-secondary" style={{ fontSize: "var(--text-sm)" }}>
          24h Overview
        </span>
        <span className={`pill ${sentiment.className}`}>
          {sentiment.label}
        </span>
      </div>

      {/* Bullet Points */}
      <div className="data-cell mb-5">
        <ul className="space-y-3">
          {data.bullets.map((bullet, index) => (
            <li
              key={index}
              className="flex items-start gap-3 text-primary"
              style={{ fontSize: "var(--text-sm)", lineHeight: 1.5 }}
            >
              <span className="text-accent mt-0.5">•</span>
              <span dangerouslySetInnerHTML={{
                __html: bullet.replace(/\*([^*]+)\*/g, '<span class="text-accent font-medium">$1</span>')
              }} />
            </li>
          ))}
        </ul>
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
                  <span className="text-muted hidden sm:inline" style={{ fontSize: "var(--text-xs)" }}>
                    {item.name}
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
                  <span className="text-muted hidden sm:inline" style={{ fontSize: "var(--text-xs)" }}>
                    {item.name}
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

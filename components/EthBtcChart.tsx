"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface EthBtcChartProps {
  currentRatio: number;
  getEthBtcContext: (ratio: number) => string;
}

type Timeframe = "7" | "30" | "90" | "365" | "ytd" | "max";

const TIMEFRAME_OPTIONS: { value: Timeframe; label: string }[] = [
  { value: "7", label: "7D" },
  { value: "30", label: "1M" },
  { value: "90", label: "3M" },
  { value: "365", label: "1Y" },
  { value: "ytd", label: "YTD" },
];

// Chart dimensions — wide aspect ratio to minimize side whitespace
const CHART_WIDTH = 900;
const CHART_HEIGHT = 220;
const PADDING_LEFT = 50;
const PADDING_RIGHT = 10;
const PADDING_TOP = 15;
const PADDING_BOTTOM = 30;
const PLOT_WIDTH = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

export default function EthBtcChart({ currentRatio, getEthBtcContext }: EthBtcChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("90");
  const [prices, setPrices] = useState<[number, number][]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const fetchHistory = useCallback(async (tf: Timeframe) => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/ethbtc-history?days=${tf}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setPrices(data.prices || []);
    } catch {
      setError("Failed to load chart data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(timeframe);
  }, [timeframe, fetchHistory]);

  // Downsample data to max ~150 points for performance
  const downsampled = (() => {
    if (prices.length <= 150) return prices;
    const step = Math.ceil(prices.length / 150);
    return prices.filter((_, i) => i % step === 0 || i === prices.length - 1);
  })();

  const minVal = downsampled.length > 0 ? Math.min(...downsampled.map(p => p[1])) : 0;
  const maxVal = downsampled.length > 0 ? Math.max(...downsampled.map(p => p[1])) : 1;
  const range = maxVal - minVal || 0.001;

  // Add 5% padding to y-axis
  const yMin = minVal - range * 0.05;
  const yMax = maxVal + range * 0.05;
  const yRange = yMax - yMin;

  const toX = (i: number) => PADDING_LEFT + (i / Math.max(downsampled.length - 1, 1)) * PLOT_WIDTH;
  const toY = (val: number) => PADDING_TOP + (1 - (val - yMin) / yRange) * PLOT_HEIGHT;

  // Build SVG path
  const pathD = downsampled
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(p[1]).toFixed(1)}`)
    .join(" ");

  // Gradient fill path
  const fillD = downsampled.length > 0
    ? `${pathD} L${toX(downsampled.length - 1).toFixed(1)},${(PADDING_TOP + PLOT_HEIGHT).toFixed(1)} L${PADDING_LEFT},${(PADDING_TOP + PLOT_HEIGHT).toFixed(1)} Z`
    : "";

  // Y-axis labels (4 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = yMin + (yRange * i) / 4;
    return { val, y: toY(val) };
  });

  // X-axis labels (5 ticks)
  const xTicks = downsampled.length > 1
    ? Array.from({ length: 5 }, (_, i) => {
        const idx = Math.round((i / 4) * (downsampled.length - 1));
        const ts = downsampled[idx][0];
        return { x: toX(idx), label: formatDate(ts, timeframe) };
      })
    : [];

  // Handle mouse hover — use SVG's getScreenCTM for accurate coordinate mapping
  // regardless of how the viewBox scales within the container
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (downsampled.length === 0 || !svgRef.current) return;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return;
    const svgX = (e.clientX - ctm.e) / ctm.a;
    const relX = svgX - PADDING_LEFT;
    if (relX < 0 || relX > PLOT_WIDTH) {
      setHoverIndex(null);
      return;
    }
    const idx = Math.round((relX / PLOT_WIDTH) * (downsampled.length - 1));
    setHoverIndex(Math.max(0, Math.min(idx, downsampled.length - 1)));
  };

  const hoverPoint = hoverIndex !== null ? downsampled[hoverIndex] : null;

  // Calculate change percentage
  const firstPrice = downsampled.length > 0 ? downsampled[0][1] : 0;
  const lastPrice = downsampled.length > 0 ? downsampled[downsampled.length - 1][1] : 0;
  const changePercent = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;

  return (
    <div className="card p-5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-muted" style={{ fontSize: "var(--text-sm)" }}>ETH/BTC</span>
          <div className="flex items-center gap-3">
            <span className="font-mono text-primary font-bold" style={{ fontSize: "var(--text-2xl)" }}>
              {currentRatio.toFixed(5)}
            </span>
            {downsampled.length > 0 && (
              <span
                className={`pill ${changePercent >= 0 ? "pill-up" : "pill-down"}`}
                style={{ fontSize: "var(--text-xs)" }}
              >
                {changePercent >= 0 ? "+" : ""}{changePercent.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        <div
          className="px-3 py-1.5 rounded-lg text-right"
          style={{ backgroundColor: "var(--bg-tertiary)" }}
        >
          <span className="text-secondary" style={{ fontSize: "var(--text-sm)" }}>
            {getEthBtcContext(currentRatio)}
          </span>
        </div>
      </div>

      {/* Timeframe buttons */}
      <div className="flex gap-1 mb-4">
        {TIMEFRAME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTimeframe(opt.value)}
            className={`px-2.5 py-1 rounded transition-colors ${
              timeframe === opt.value
                ? "bg-[var(--accent)] text-white"
                : "bg-tertiary text-secondary hover:bg-hover"
            }`}
            style={{ fontSize: "var(--text-xs)" }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Chart area */}
      {isLoading ? (
        <div className="flex items-center justify-center" style={{ height: CHART_HEIGHT }}>
          <div className="flex items-center gap-2">
            <span className="loading-dot"></span>
            <span className="loading-dot"></span>
            <span className="loading-dot"></span>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center" style={{ height: CHART_HEIGHT }}>
          <span className="text-muted" style={{ fontSize: "var(--text-sm)" }}>{error}</span>
        </div>
      ) : (
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            className="w-full"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverIndex(null)}
          >
            <defs>
              <linearGradient id="ethbtc-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {yTicks.map((tick, i) => (
              <line
                key={i}
                x1={PADDING_LEFT}
                x2={CHART_WIDTH - PADDING_RIGHT}
                y1={tick.y}
                y2={tick.y}
                stroke="var(--border-color)"
                strokeWidth="0.5"
                strokeDasharray="4,4"
                opacity="0.5"
              />
            ))}

            {/* Fill area */}
            {fillD && (
              <path d={fillD} fill="url(#ethbtc-fill)" />
            )}

            {/* Line */}
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            )}

            {/* Hover crosshair + dot */}
            {hoverPoint && hoverIndex !== null && (
              <>
                <line
                  x1={toX(hoverIndex)}
                  x2={toX(hoverIndex)}
                  y1={PADDING_TOP}
                  y2={PADDING_TOP + PLOT_HEIGHT}
                  stroke="var(--text-muted)"
                  strokeWidth="0.5"
                  strokeDasharray="3,3"
                />
                <circle
                  cx={toX(hoverIndex)}
                  cy={toY(hoverPoint[1])}
                  r="3.5"
                  fill="var(--accent)"
                  stroke="var(--bg-primary)"
                  strokeWidth="1.5"
                />
              </>
            )}

            {/* Y-axis labels */}
            {yTicks.map((tick, i) => (
              <text
                key={i}
                x={PADDING_LEFT - 8}
                y={tick.y + 3}
                textAnchor="end"
                fill="var(--text-muted)"
                fontSize="9"
                fontFamily="monospace"
              >
                {tick.val.toFixed(4)}
              </text>
            ))}

            {/* X-axis labels */}
            {xTicks.map((tick, i) => (
              <text
                key={i}
                x={tick.x}
                y={CHART_HEIGHT - 5}
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize="9"
              >
                {tick.label}
              </text>
            ))}
          </svg>

          {/* Hover tooltip */}
          {hoverPoint && hoverIndex !== null && (
            <div
              className="absolute pointer-events-none px-2 py-1 rounded-md shadow-lg"
              style={{
                left: `${(toX(hoverIndex) / CHART_WIDTH) * 100}%`,
                top: "0px",
                transform: "translateX(-50%)",
                backgroundColor: "var(--bg-primary)",
                border: "1px solid var(--border-color)",
                fontSize: "var(--text-xs)",
                whiteSpace: "nowrap",
              }}
            >
              <span className="text-muted">
                {new Date(hoverPoint[0]).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="text-primary font-mono font-semibold ml-2">
                {hoverPoint[1].toFixed(5)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatDate(timestamp: number, timeframe: Timeframe): string {
  const date = new Date(timestamp);
  if (timeframe === "7") {
    return date.toLocaleDateString(undefined, { weekday: "short" });
  }
  if (timeframe === "30" || timeframe === "90") {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ReportButton from "@/components/ReportButton";
import ReportDisplay from "@/components/ReportDisplay";
import WhatsUpButton from "@/components/WhatsUpButton";
import WhatsUpDisplay, { WhatsUpData, TieredTopMovers } from "@/components/WhatsUpDisplay";
import TopMovers from "@/components/TopMovers";
import RefreshPricesButton from "@/components/RefreshPricesButton";
import ThemeToggle from "@/components/ThemeToggle";
import CoinSelector from "@/components/CoinSelector";
import EthBtcChart from "@/components/EthBtcChart";
import Link from "next/link";

interface DisplayItem {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price: number | string;
  price_change_percentage_24h: number | null;
  isRatio?: boolean;
  sparkline?: number[];
}

function renderSparkline(data: number[], isPositive: boolean) {
  const W = 60;
  const H = 20;
  const len = data.length;
  if (len < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((val, i) => {
      const x = (i / (len - 1)) * W;
      const y = H - ((val - min) / range) * H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const color = isPositive ? "var(--sparkline-positive)" : "var(--sparkline-negative)";

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="mt-1"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface AvailableCoin {
  id: string;
  symbol: string;
  name: string;
  image?: string;
}

const DEFAULT_SELECTED_COINS = ["bitcoin", "ethereum", "solana", "binancecoin", "ripple", "hyperliquid"];

export default function Home() {
  const [report, setReport] = useState<string>("");
  const [displayItems, setDisplayItems] = useState<DisplayItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [whatsUpData, setWhatsUpData] = useState<WhatsUpData | null>(null);
  const [isWhatsUpLoading, setIsWhatsUpLoading] = useState(false);
  const [isPricesLoading, setIsPricesLoading] = useState(false);
  const [lastPriceUpdate, setLastPriceUpdate] = useState<Date | null>(null);

  const [availableCoins, setAvailableCoins] = useState<AvailableCoin[]>([]);
  const [selectedCoins, setSelectedCoins] = useState<string[]>(DEFAULT_SELECTED_COINS);
  const [hasPinnedCoins, setHasPinnedCoins] = useState(false);
  const [hasWhatsUp, setHasWhatsUp] = useState(false);
  const [hasReport, setHasReport] = useState(false);
  const [isReportAuthenticated, setIsReportAuthenticated] = useState(false);
  const [isMarketSummaryCollapsed, setIsMarketSummaryCollapsed] = useState(false);
  const [isReportCollapsed, setIsReportCollapsed] = useState(false);
  const [isEthBtcCollapsed, setIsEthBtcCollapsed] = useState(true);
  const [isTopMoversCollapsed, setIsTopMoversCollapsed] = useState(true);
  const [topMovers, setTopMovers] = useState<TieredTopMovers | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(60);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPricesLoadingRef = useRef(false);

  // Keep ref in sync with loading state for auto-refresh interval
  useEffect(() => {
    isPricesLoadingRef.current = isPricesLoading;
  }, [isPricesLoading]);

  // Auto-refresh prices every 60 seconds
  useEffect(() => {
    autoRefreshRef.current = setInterval(() => {
      setSecondsUntilRefresh((prev) => {
        if (prev <= 1) {
          // Trigger refresh if not already loading
          if (!isPricesLoadingRef.current) {
            refreshPrices();
          }
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Admin mode: Ctrl+Shift+K toggles, persisted in localStorage
  const handleAdminToggle = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "K") {
      e.preventDefault();
      setIsAdmin((prev) => {
        const next = !prev;
        try { localStorage.setItem("_m", next ? "1" : ""); } catch { /* ignore */ }
        return next;
      });
    }
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem("_m") === "1") setIsAdmin(true);
    } catch { /* ignore */ }
    window.addEventListener("keydown", handleAdminToggle);
    return () => window.removeEventListener("keydown", handleAdminToggle);
  }, [handleAdminToggle]);

  // Load pinned coins from localStorage (client-side only to avoid hydration mismatch)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pinnedCoins");
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedCoins(parsed);
          setHasPinnedCoins(true);
          refreshPrices(parsed);
          return;
        }
      }
    } catch {
      // Ignore parse errors
    }
    refreshPrices();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshAll = async (coins?: string[]) => {
    setIsPricesLoading(true);
    setError("");
    setSecondsUntilRefresh(60);

    // Also set loading states for whatsup and report if they exist
    if (hasWhatsUp) {
      setIsWhatsUpLoading(true);
      setIsMarketSummaryCollapsed(false);
    }
    if (hasReport && isReportAuthenticated) {
      setIsLoading(true);
      setIsReportCollapsed(false);
    }

    try {
      const coinsParam = (coins || selectedCoins).join(",");

      // Fetch prices first
      const pricesResponse = await fetch(`/api/prices?coins=${coinsParam}`);
      if (!pricesResponse.ok) {
        throw new Error("Failed to fetch prices");
      }
      const pricesData = await pricesResponse.json();
      setDisplayItems(pricesData.displayItems);
      setAvailableCoins(pricesData.availableCoins || []);
      const newTopMovers = pricesData.topMovers || {
        top50: { gainers: [], losers: [] },
        top100: { gainers: [], losers: [] },
        top200: { gainers: [], losers: [] },
        top300: { gainers: [], losers: [] },
      };
      setTopMovers(newTopMovers);
      setLastPriceUpdate(new Date());
      setIsPricesLoading(false);

      // Refresh whatsup if it was displayed
      if (hasWhatsUp) {
        try {
          const whatsUpResponse = await fetch("/api/whatsup?refresh=true");
          if (whatsUpResponse.ok) {
            const whatsUpResult = await whatsUpResponse.json();
            setWhatsUpData({
              ...whatsUpResult,
              topMovers: newTopMovers,
            });
          }
        } catch {
          // Silently fail whatsup refresh, prices are already updated
        } finally {
          setIsWhatsUpLoading(false);
        }
      }

      // Refresh report if it was generated and user is authenticated
      if (hasReport && isReportAuthenticated) {
        try {
          const reportResponse = await fetch("/api/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ prices: pricesData.coins }),
          });
          if (reportResponse.ok) {
            const reportResult = await reportResponse.json();
            setReport(reportResult.report);
          }
        } catch {
          // Silently fail report refresh
        } finally {
          setIsLoading(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh");
      setIsPricesLoading(false);
      setIsWhatsUpLoading(false);
      setIsLoading(false);
    }
  };

  // Simple prices-only refresh for coin selection changes
  const refreshPrices = async (coins?: string[]) => {
    setIsPricesLoading(true);
    setError("");
    setSecondsUntilRefresh(60);

    try {
      const coinsParam = (coins || selectedCoins).join(",");
      const pricesResponse = await fetch(`/api/prices?coins=${coinsParam}`);
      if (!pricesResponse.ok) {
        throw new Error("Failed to fetch prices");
      }
      const data = await pricesResponse.json();
      setDisplayItems(data.displayItems);
      setAvailableCoins(data.availableCoins || []);
      const newTopMovers = data.topMovers || {
        top50: { gainers: [], losers: [] },
        top100: { gainers: [], losers: [] },
        top200: { gainers: [], losers: [] },
        top300: { gainers: [], losers: [] },
      };
      setTopMovers(newTopMovers);
      setLastPriceUpdate(new Date());

      // Also update market summary top movers if it's been displayed
      if (hasWhatsUp && whatsUpData) {
        setWhatsUpData({
          ...whatsUpData,
          topMovers: newTopMovers,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh prices");
    } finally {
      setIsPricesLoading(false);
    }
  };

  const handleCoinSelectionChange = (newSelection: string[]) => {
    setSelectedCoins(newSelection);
    setHasPinnedCoins(true);
    try {
      localStorage.setItem("pinnedCoins", JSON.stringify(newSelection));
    } catch {
      // Ignore storage errors
    }
    refreshPrices(newSelection);
  };

  const resetToDefaultCoins = () => {
    setSelectedCoins(DEFAULT_SELECTED_COINS);
    setHasPinnedCoins(false);
    try {
      localStorage.removeItem("pinnedCoins");
    } catch {
      // Ignore storage errors
    }
    refreshPrices(DEFAULT_SELECTED_COINS);
  };

  const fetchWhatsUp = async () => {
    setIsWhatsUpLoading(true);
    setError("");
    // Expand market summary when fetching new data
    setIsMarketSummaryCollapsed(false);

    try {
      // Fetch fresh prices and whatsup data in parallel
      const coinsParam = selectedCoins.join(",");
      const [pricesResponse, whatsUpResponse] = await Promise.all([
        fetch(`/api/prices?coins=${coinsParam}`),
        fetch("/api/whatsup"),
      ]);

      if (!pricesResponse.ok) {
        throw new Error("Failed to fetch prices");
      }
      if (!whatsUpResponse.ok) {
        const errorData = await whatsUpResponse.json();
        throw new Error(errorData.error || "Failed to fetch market summary");
      }

      const pricesData = await pricesResponse.json();
      const whatsUpData = await whatsUpResponse.json();

      // Update prices and top movers
      setDisplayItems(pricesData.displayItems);
      setAvailableCoins(pricesData.availableCoins || []);
      setTopMovers(pricesData.topMovers || null);
      setLastPriceUpdate(new Date());

      // Set whatsup data with fresh top movers
      setWhatsUpData({
        ...whatsUpData,
        topMovers: pricesData.topMovers,
      });
      setHasWhatsUp(true);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsWhatsUpLoading(false);
    }
  };

  const generateReport = async () => {
    setIsLoading(true);
    setError("");
    setReport("");
    setIsReportCollapsed(false); // Expand report section when generating
    // Collapse market summary when generating report
    if (hasWhatsUp) {
      setIsMarketSummaryCollapsed(true);
    }

    try {
      const coinsParam = selectedCoins.join(",");
      const pricesResponse = await fetch(`/api/prices?coins=${coinsParam}`);
      if (!pricesResponse.ok) {
        throw new Error("Failed to fetch prices");
      }
      const data = await pricesResponse.json();
      setDisplayItems(data.displayItems);
      setLastPriceUpdate(new Date());

      const reportResponse = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prices: data.coins }),
      });

      if (!reportResponse.ok) {
        const errorData = await reportResponse.json();
        throw new Error(errorData.error || "Failed to generate update");
      }

      const reportData = await reportResponse.json();
      setReport(reportData.report);
      setHasReport(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  // Separate ETHBTC ratio from regular price items
  const ethBtcItem = displayItems.find((item) => item.isRatio);
  const priceItems = displayItems.filter((item) => !item.isRatio);

  const formatPrice = (item: DisplayItem) => {
    if (item.isRatio) {
      return item.current_price;
    }
    const price = item.current_price as number;
    const formatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: price >= 1000 ? 0 : 2,
      maximumFractionDigits: price >= 1000 ? 0 : 2,
    });
    return formatter.format(price);
  };

  return (
    <div className="min-h-screen bg-primary">
      {/* Header */}
      <header className="header">
        <div className="header-content max-w-6xl mx-auto flex items-center justify-between">
          <div className="header-info flex items-center gap-3">
            {/* Logo */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "var(--accent)" }}
              aria-hidden="true"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-primary">
                Crypto - What&apos;s Up?
              </h1>
              <p className="header-subtitle text-muted flex items-center gap-1" style={{ fontSize: "var(--text-xs)" }}>
                <span>Liquid markets update with one click</span>
                <span className="hidden sm:inline">|</span>
                <span className="flex items-center gap-1">
                  Powered by{" "}
                  <a
                    href="https://x.com/cptn3mox"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline inline-flex items-center gap-1"
                  >
                    <img
                      src="https://unavatar.io/twitter/cptn3mox"
                      alt="cptn3mox"
                      className="w-4 h-4 rounded-full"
                      width={16}
                      height={16}
                      loading="lazy"
                    />
                    @cptn3mox
                  </a>
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link
                href="/archive"
                className="btn-ghost flex items-center gap-1"
                style={{ fontSize: "var(--text-xs)", opacity: 0.5 }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Archive
              </Link>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-5 py-6">
        {/* Error Display */}
        {error && (
          <div
            className="card p-3 mb-5 flex items-center gap-2"
            style={{ borderColor: "var(--danger)", backgroundColor: "var(--danger-bg)" }}
          >
            <svg className="w-4 h-4 flex-shrink-0" style={{ color: "var(--danger)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm" style={{ color: "var(--danger)" }}>{error}</span>
          </div>
        )}

        {/* Hero CTA Section */}
        <section className="mb-6">
          <div className="card-cta p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
                <h2 className="font-bold text-primary" style={{ fontSize: "var(--text-xl)" }}>
                  Get Your Market Briefing
                </h2>
              </div>
              {isAdmin && (
                <div className="hidden sm:block" style={{ opacity: 0.5 }}>
                  <ReportButton onClick={generateReport} isLoading={isLoading} onAuthenticated={() => setIsReportAuthenticated(true)} />
                </div>
              )}
            </div>
            <p className="text-secondary mb-4" style={{ fontSize: "var(--text-sm)", lineHeight: 1.6 }}>
              AI-powered 24-48h market intelligence. Scans X/Twitter, analyzes price action across 300+ coins, and delivers a concise briefing with interactive follow-up.
            </p>
            <div className="flex justify-center sm:justify-start [&>button]:w-full sm:[&>button]:w-auto sm:[&>button]:min-w-[200px]">
              <WhatsUpButton onClick={fetchWhatsUp} isLoading={isWhatsUpLoading} />
            </div>
            <p className="text-muted mt-3" style={{ fontSize: "var(--text-xs)" }}>
              Takes ~45 seconds | Sources: X/Twitter, CoinGecko, AI analysis
            </p>

            {/* Inline feature cards — shown only before first briefing */}
            {!hasWhatsUp && !isWhatsUpLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-5" style={{ borderTop: "1px solid var(--border-color)" }}>
                <div className="data-cell">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    <span className="font-semibold text-primary" style={{ fontSize: "var(--text-sm)" }}>Market Bullets</span>
                  </div>
                  <p className="text-secondary" style={{ fontSize: "var(--text-xs)", lineHeight: 1.5 }}>
                    Key events from the last 24-48h with expandable AI analysis
                  </p>
                </div>
                <div className="data-cell">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span className="font-semibold text-primary" style={{ fontSize: "var(--text-sm)" }}>Follow-Up Chat</span>
                  </div>
                  <p className="text-secondary" style={{ fontSize: "var(--text-xs)", lineHeight: 1.5 }}>
                    Ask questions about any point to dig deeper into the data
                  </p>
                </div>
                <div className="data-cell">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span className="font-semibold text-primary" style={{ fontSize: "var(--text-sm)" }}>Top Movers</span>
                  </div>
                  <p className="text-secondary" style={{ fontSize: "var(--text-xs)", lineHeight: 1.5 }}>
                    Biggest gainers and losers across the top 50-300 coins
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Prices Section */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h2 className="font-bold text-primary" style={{ fontSize: "var(--text-lg)" }}>
                Current Prices
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <CoinSelector
                coins={availableCoins}
                selectedCoins={selectedCoins}
                onSelectionChange={handleCoinSelectionChange}
                maxSelection={11}
              />
              {hasPinnedCoins && (
                <button
                  onClick={resetToDefaultCoins}
                  className="btn-ghost flex items-center gap-1"
                  style={{ fontSize: "var(--text-xs)" }}
                  aria-label="Reset coin selection to defaults"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reset
                </button>
              )}
              <RefreshPricesButton onClick={() => refreshAll()} isLoading={isPricesLoading || isWhatsUpLoading || isLoading} secondsUntilRefresh={secondsUntilRefresh} />
            </div>
          </div>

          <div className="card p-4">
            {priceItems.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {priceItems.map((item) => (
                  <div key={item.id} className="data-cell">
                    <div className="flex items-center gap-1.5 mb-1">
                      {item.image && (
                        <img src={item.image} alt={item.name} className="w-4 h-4 rounded-full" width={16} height={16} loading="lazy" />
                      )}
                      <span className="text-muted font-medium" style={{ fontSize: "var(--text-sm)" }}>
                        {item.symbol}
                      </span>
                    </div>
                    <div className="font-mono text-primary font-semibold truncate" style={{ fontSize: "var(--text-lg)" }}>
                      {formatPrice(item)}
                    </div>
                    {item.price_change_percentage_24h !== null && (
                      <div
                        className={`pill mt-2 ${item.price_change_percentage_24h >= 0 ? "pill-up" : "pill-down"}`}
                      >
                        {item.price_change_percentage_24h >= 0 ? "+" : ""}
                        {item.price_change_percentage_24h.toFixed(2)}%
                      </div>
                    )}
                    {item.sparkline && item.sparkline.length > 1 && renderSparkline(
                      item.sparkline,
                      (item.price_change_percentage_24h ?? 0) >= 0
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                {isPricesLoading ? (
                  <div className="flex items-center gap-2">
                    <span className="loading-dot"></span>
                    <span className="loading-dot"></span>
                    <span className="loading-dot"></span>
                  </div>
                ) : (
                  <span className="text-muted text-sm">Click refresh to load prices</span>
                )}
              </div>
            )}
            {/* CoinGecko attribution */}
            <div className="mt-3 pt-3 flex items-center justify-end gap-2" style={{ borderTop: "1px solid var(--border-color)" }}>
              <span className="text-muted" style={{ fontSize: "var(--text-xs)" }}>
                Prices via{" "}
                <a
                  href="https://www.coingecko.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  CoinGecko
                </a>
              </span>
              {lastPriceUpdate && (
                <span className="text-muted" style={{ fontSize: "var(--text-xs)" }}>
                  • {new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "numeric", second: "numeric" }).format(lastPriceUpdate)}
                </span>
              )}
            </div>

            {/* ETH/BTC Ratio Chart - Collapsible, nested in prices */}
            {ethBtcItem && (
              <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
                <button
                  onClick={() => setIsEthBtcCollapsed(!isEthBtcCollapsed)}
                  className="w-full flex items-center justify-between cursor-pointer py-1"
                  aria-expanded={!isEthBtcCollapsed}
                  aria-label={isEthBtcCollapsed ? "Expand ETH/BTC ratio" : "Collapse ETH/BTC ratio"}
                >
                  <span className="font-semibold text-primary" style={{ fontSize: "var(--text-sm)" }}>
                    ETH/BTC Ratio
                  </span>
                  <span className="flex items-center gap-2">
                    {isEthBtcCollapsed && (
                      <span className="font-mono text-muted" style={{ fontSize: "var(--text-sm)" }}>
                        {ethBtcItem.current_price}
                      </span>
                    )}
                    <svg
                      className={`w-3.5 h-3.5 text-muted chevron ${!isEthBtcCollapsed ? "chevron-open" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>
                {!isEthBtcCollapsed && (
                  <div className="mt-3">
                    <EthBtcChart
                      currentRatio={parseFloat(String(ethBtcItem.current_price))}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Top Movers - Collapsible, nested in prices */}
            {topMovers && (
              <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
                <button
                  onClick={() => setIsTopMoversCollapsed(!isTopMoversCollapsed)}
                  className="w-full flex items-center justify-between cursor-pointer py-1"
                  aria-expanded={!isTopMoversCollapsed}
                  aria-label={isTopMoversCollapsed ? "Expand top movers" : "Collapse top movers"}
                >
                  <span className="font-semibold text-primary" style={{ fontSize: "var(--text-sm)" }}>
                    Top Movers
                  </span>
                  <span className="flex items-center gap-2">
                    {isTopMoversCollapsed && topMovers.top100 && (
                      <span className="flex items-center gap-2" style={{ fontSize: "var(--text-xs)" }}>
                        {topMovers.top100.gainers[0] && (
                          <span style={{ color: "var(--success)" }}>
                            {topMovers.top100.gainers[0].symbol} {topMovers.top100.gainers[0].change}
                          </span>
                        )}
                        {topMovers.top100.losers[0] && (
                          <span style={{ color: "var(--danger)" }}>
                            {topMovers.top100.losers[0].symbol} {topMovers.top100.losers[0].change}
                          </span>
                        )}
                      </span>
                    )}
                    <svg
                      className={`w-3.5 h-3.5 text-muted chevron ${!isTopMoversCollapsed ? "chevron-open" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>
                {!isTopMoversCollapsed && (
                  <div className="mt-3">
                    <TopMovers topMovers={topMovers} />
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Market Summary Section (What's Up) - Collapsible */}
        {(hasWhatsUp || isWhatsUpLoading) && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-primary" style={{ fontSize: "var(--text-lg)" }}>
                Market Summary
              </h2>
              {hasWhatsUp && !isWhatsUpLoading && (
                <button
                  onClick={() => setIsMarketSummaryCollapsed(!isMarketSummaryCollapsed)}
                  className="btn-ghost flex items-center gap-1"
                  style={{ fontSize: "var(--text-xs)" }}
                  aria-expanded={!isMarketSummaryCollapsed}
                  aria-label={isMarketSummaryCollapsed ? "Expand market summary" : "Collapse market summary"}
                >
                  {isMarketSummaryCollapsed ? (
                    <>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      Show More
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                      Collapse
                    </>
                  )}
                </button>
              )}
            </div>
            {!isMarketSummaryCollapsed && (
              <WhatsUpDisplay
                data={whatsUpData || {
                  bullets: [],
                  conclusion: "",
                  sentiment: "neutral",
                  topMovers: {
                    top50: { gainers: [], losers: [] },
                    top100: { gainers: [], losers: [] },
                    top200: { gainers: [], losers: [] },
                    top300: { gainers: [], losers: [] },
                  },
                  timestamp: ""
                }}
                isLoading={isWhatsUpLoading}
              />
            )}
            {isMarketSummaryCollapsed && (
              <div className="card p-3 text-center">
                <span className="text-muted" style={{ fontSize: "var(--text-sm)" }}>
                  Market summary collapsed. Click &quot;Show More&quot; to expand.
                </span>
              </div>
            )}
          </section>
        )}

        {/* Report Section - Collapsible (admin only) */}
        {isAdmin && (hasReport || isLoading) && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-primary" style={{ fontSize: "var(--text-lg)" }}>
                Weekly Update
              </h2>
              {hasReport && !isLoading && (
                <button
                  onClick={() => setIsReportCollapsed(!isReportCollapsed)}
                  className="btn-ghost flex items-center gap-1"
                  style={{ fontSize: "var(--text-xs)" }}
                  aria-expanded={!isReportCollapsed}
                  aria-label={isReportCollapsed ? "Expand weekly update" : "Collapse weekly update"}
                >
                  {isReportCollapsed ? (
                    <>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      Show More
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                      Collapse
                    </>
                  )}
                </button>
              )}
            </div>
            {!isReportCollapsed && (
              <ReportDisplay report={report} isLoading={isLoading} />
            )}
            {isReportCollapsed && (
              <div className="card p-3 text-center">
                <span className="text-muted" style={{ fontSize: "var(--text-sm)" }}>
                  Weekly update collapsed. Click &quot;Show More&quot; to expand.
                </span>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

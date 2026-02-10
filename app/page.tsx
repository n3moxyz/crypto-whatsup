"use client";

import { useState, useEffect } from "react";
import ReportButton from "@/components/ReportButton";
import ReportDisplay from "@/components/ReportDisplay";
import WhatsUpButton from "@/components/WhatsUpButton";
import WhatsUpDisplay, { WhatsUpData } from "@/components/WhatsUpDisplay";
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
        fetch("/api/whatsup?refresh=true"),
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

  const getEthBtcContext = (ratio: number): string => {
    if (ratio < 0.025) return "Pre-BMNR levels";
    if (ratio < 0.032) return "Cycle lows territory";
    if (ratio < 0.040) return "Below long-term average";
    if (ratio < 0.055) return "Healthy range";
    return "ETH outperforming";
  };

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
            <Link
              href="/archive"
              className="btn-ghost flex items-center gap-1"
              style={{ fontSize: "var(--text-xs)" }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Archive
            </Link>
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

        {/* Prices Section */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h2 className="font-bold text-primary" style={{ fontSize: "var(--text-base)" }}>
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
              <RefreshPricesButton onClick={() => refreshAll()} isLoading={isPricesLoading || isWhatsUpLoading || isLoading} />
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
                      <span className="text-muted" style={{ fontSize: "var(--text-xs)" }}>
                        {item.symbol}
                      </span>
                    </div>
                    <div className="font-mono text-primary font-semibold" style={{ fontSize: "var(--text-lg)" }}>
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
          </div>
        </section>

        {/* ETH/BTC Ratio Chart - Collapsible */}
        {ethBtcItem && (
          <section className="mb-6">
            <button
              onClick={() => setIsEthBtcCollapsed(!isEthBtcCollapsed)}
              className="flex items-center gap-2 mb-3 cursor-pointer"
              aria-expanded={!isEthBtcCollapsed}
              aria-label={isEthBtcCollapsed ? "Expand ETH/BTC ratio" : "Collapse ETH/BTC ratio"}
            >
              <h2 className="font-bold text-primary" style={{ fontSize: "var(--text-base)" }}>
                ETH/BTC Ratio
              </h2>
              <span className="btn-ghost flex items-center gap-1" style={{ fontSize: "var(--text-xs)" }}>
                {isEthBtcCollapsed ? (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    Show
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    Collapse
                  </>
                )}
              </span>
            </button>
            {!isEthBtcCollapsed && (
              <EthBtcChart
                currentRatio={parseFloat(String(ethBtcItem.current_price))}
                getEthBtcContext={getEthBtcContext}
              />
            )}
          </section>
        )}

        {/* Actions Section */}
        <section className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-bold text-primary" style={{ fontSize: "var(--text-base)" }}>
                Actions
              </h2>
              <WhatsUpButton onClick={fetchWhatsUp} isLoading={isWhatsUpLoading} />
              {/* Info icon with hover tooltip */}
              <div className="relative group">
                <button
                  className="w-4 h-4 rounded-full flex items-center justify-center text-muted hover:text-primary transition-colors"
                  style={{
                    backgroundColor: "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                    fontSize: "10px",
                  }}
                  aria-label="How to use this app"
                >
                  i
                </button>
                {/* Tooltip on hover */}
                <div
                  className="absolute left-0 top-full mt-2 w-72 p-4 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50"
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid var(--border-color)",
                    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
                  }}
                >
                  <h4 className="text-primary font-semibold mb-3" style={{ fontSize: "var(--text-sm)" }}>
                    How to use
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-accent font-medium" style={{ fontSize: "var(--text-xs)" }}>1.</span>
                      <p className="text-secondary" style={{ fontSize: "var(--text-xs)", lineHeight: 1.5 }}>
                        Press <span className="font-medium text-accent">What&apos;s Up?</span> to get the latest market summary (24-48h)
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-accent font-medium" style={{ fontSize: "var(--text-xs)" }}>2.</span>
                      <p className="text-secondary" style={{ fontSize: "var(--text-xs)", lineHeight: 1.5 }}>
                        Click <span className="italic">Tell me more</span> on any point for deeper explanation
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-accent font-medium" style={{ fontSize: "var(--text-xs)" }}>3.</span>
                      <p className="text-secondary" style={{ fontSize: "var(--text-xs)", lineHeight: 1.5 }}>
                        Ask follow-up questions to dig even deeper
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Generate Update button - faded, right-aligned for internal use */}
            <div style={{ opacity: 0.5 }}>
              <ReportButton onClick={generateReport} isLoading={isLoading} onAuthenticated={() => setIsReportAuthenticated(true)} />
            </div>
          </div>
        </section>

        {/* Market Summary Section (What's Up) - Collapsible */}
        {(hasWhatsUp || isWhatsUpLoading) && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-primary" style={{ fontSize: "var(--text-base)" }}>
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

        {/* Report Section - Collapsible */}
        {(hasReport || isLoading) && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-primary" style={{ fontSize: "var(--text-base)" }}>
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

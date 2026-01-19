"use client";

import { useState, useEffect } from "react";
import ReportButton from "@/components/ReportButton";
import ReportDisplay from "@/components/ReportDisplay";
import WhatsUpButton from "@/components/WhatsUpButton";
import WhatsUpDisplay, { WhatsUpData, TopMover } from "@/components/WhatsUpDisplay";
import RefreshPricesButton from "@/components/RefreshPricesButton";
import ThemeToggle from "@/components/ThemeToggle";
import CoinSelector from "@/components/CoinSelector";

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

const DEFAULT_SELECTED_COINS = ["bitcoin", "ethereum", "solana", "binancecoin", "ripple"];

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
  const [topMovers, setTopMovers] = useState<{
    top50: { gainers: TopMover[]; losers: TopMover[] };
    top100: { gainers: TopMover[]; losers: TopMover[] };
    top200: { gainers: TopMover[]; losers: TopMover[] };
    top300: { gainers: TopMover[]; losers: TopMover[] };
  }>({
    top50: { gainers: [], losers: [] },
    top100: { gainers: [], losers: [] },
    top200: { gainers: [], losers: [] },
    top300: { gainers: [], losers: [] },
  });

  const [hasWhatsUp, setHasWhatsUp] = useState(false);
  const [hasReport, setHasReport] = useState(false);
  const [isMarketSummaryCollapsed, setIsMarketSummaryCollapsed] = useState(false);

  useEffect(() => {
    refreshPrices();
  }, []);

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
      setTopMovers(data.topMovers || {
        top50: { gainers: [], losers: [] },
        top100: { gainers: [], losers: [] },
        top200: { gainers: [], losers: [] },
        top300: { gainers: [], losers: [] },
      });
      setLastPriceUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh prices");
    } finally {
      setIsPricesLoading(false);
    }
  };

  const handleCoinSelectionChange = (newSelection: string[]) => {
    setSelectedCoins(newSelection);
    refreshPrices(newSelection);
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
      setTopMovers(pricesData.topMovers);
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
        throw new Error(errorData.error || "Failed to generate report");
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

  const formatPrice = (item: DisplayItem) => {
    if (item.isRatio) {
      return item.current_price;
    }
    const price = item.current_price as number;
    if (price >= 1000) {
      return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    }
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="min-h-screen bg-primary">
      {/* Header */}
      <header className="header">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "var(--accent)" }}
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-primary">
                Crypto Report Generator
              </h1>
              <p className="text-muted flex items-center gap-1" style={{ fontSize: "var(--text-xs)" }}>
                Liquid markets update with one click | Powered by{" "}
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
                  />
                  @cptn3mox
                </a>
              </p>
            </div>
          </div>
          <ThemeToggle />
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
            <svg className="w-4 h-4 flex-shrink-0" style={{ color: "var(--danger)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              {lastPriceUpdate && (
                <span className="text-muted" style={{ fontSize: "var(--text-xs)" }}>
                  {lastPriceUpdate.toLocaleTimeString()}
                </span>
              )}
              <span className="text-muted" style={{ fontSize: "var(--text-xs)" }}>
                via{" "}
                <a
                  href="https://www.coingecko.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  CoinGecko
                </a>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CoinSelector
                coins={availableCoins}
                selectedCoins={selectedCoins}
                onSelectionChange={handleCoinSelectionChange}
                maxSelection={11}
              />
              <RefreshPricesButton onClick={() => refreshPrices()} isLoading={isPricesLoading} />
            </div>
          </div>

          <div className="card p-4">
            {displayItems.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {displayItems.map((item) => (
                  <div key={item.id} className="data-cell">
                    <div className="flex items-center gap-1.5 mb-1">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-4 h-4 rounded-full" />
                      ) : (
                        <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--accent)", fontSize: "8px", color: "white" }}>
                          ⟠
                        </div>
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
          </div>
        </section>

        {/* Actions Section */}
        <section className="mb-6">
          <div className="flex items-center gap-3">
            <h2 className="font-bold text-primary" style={{ fontSize: "var(--text-base)" }}>
              Actions
            </h2>
            <WhatsUpButton onClick={fetchWhatsUp} isLoading={isWhatsUpLoading} />
            <ReportButton onClick={generateReport} isLoading={isLoading} />
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
                >
                  {isMarketSummaryCollapsed ? (
                    <>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      Show More
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                  Market summary collapsed. Click "Show More" to expand.
                </span>
              </div>
            )}
          </section>
        )}

        {/* Report Section */}
        {(hasReport || isLoading) && (
          <section className="mb-6">
            <h2 className="font-bold text-primary mb-3" style={{ fontSize: "var(--text-base)" }}>
              Report
            </h2>
            <ReportDisplay report={report} isLoading={isLoading} />
          </section>
        )}
      </main>
    </div>
  );
}

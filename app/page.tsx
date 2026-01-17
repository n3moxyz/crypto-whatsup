"use client";

import { useState } from "react";
import ReportButton from "@/components/ReportButton";
import ReportDisplay from "@/components/ReportDisplay";

interface DisplayItem {
  id: string;
  symbol: string;
  name: string;
  current_price: number | string;
  price_change_percentage_24h: number | null;
  isRatio?: boolean;
}

export default function Home() {
  const [report, setReport] = useState<string>("");
  const [displayItems, setDisplayItems] = useState<DisplayItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const generateReport = async () => {
    setIsLoading(true);
    setError("");
    setReport("");

    try {
      // Step 1: Fetch crypto prices
      const pricesResponse = await fetch("/api/prices");
      if (!pricesResponse.ok) {
        throw new Error("Failed to fetch prices");
      }
      const data = await pricesResponse.json();
      setDisplayItems(data.displayItems);

      // Step 2: Generate report using AI
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
    return `$${price.toLocaleString()}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">
            Crypto Market Report Generator
          </h1>
          <p className="text-slate-300 text-lg">
            Generate AI-powered market updates with one click
          </p>
        </header>

        {/* Generate Button */}
        <div className="flex justify-center mb-8">
          <ReportButton onClick={generateReport} isLoading={isLoading} />
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6 text-red-200 text-center">
            {error}
          </div>
        )}

        {/* Price Summary */}
        {displayItems.length > 0 && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              Current Prices
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {displayItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white/5 rounded-lg p-3 text-center"
                >
                  <div className="text-slate-300 text-sm font-medium">
                    {item.symbol}
                  </div>
                  <div className="text-white font-bold">
                    {formatPrice(item)}
                  </div>
                  {item.price_change_percentage_24h !== null && (
                    <div
                      className={`text-sm ${
                        item.price_change_percentage_24h >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {item.price_change_percentage_24h >= 0 ? "+" : ""}
                      {item.price_change_percentage_24h?.toFixed(2)}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Report Display */}
        {(report || isLoading) && (
          <ReportDisplay report={report} isLoading={isLoading} />
        )}
      </div>
    </div>
  );
}

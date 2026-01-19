"use client";

import { useState, useRef, useEffect } from "react";

interface Coin {
  id: string;
  symbol: string;
  name: string;
  image?: string;
}

interface CoinSelectorProps {
  coins: Coin[];
  selectedCoins: string[];
  onSelectionChange: (selected: string[]) => void;
  maxSelection?: number;
}

export default function CoinSelector({
  coins,
  selectedCoins,
  onSelectionChange,
  maxSelection = 8,
}: CoinSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCoins = coins.filter(
    (coin) =>
      coin.name.toLowerCase().includes(search.toLowerCase()) ||
      coin.symbol.toLowerCase().includes(search.toLowerCase())
  );

  // Sort: selected coins first, then alphabetically
  const sortedCoins = [...filteredCoins].sort((a, b) => {
    const aSelected = selectedCoins.includes(a.id);
    const bSelected = selectedCoins.includes(b.id);
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    return a.name.localeCompare(b.name);
  });

  const toggleCoin = (coinId: string) => {
    if (selectedCoins.includes(coinId)) {
      onSelectionChange(selectedCoins.filter((id) => id !== coinId));
    } else if (selectedCoins.length < maxSelection) {
      onSelectionChange([...selectedCoins, coinId]);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn-ghost flex items-center gap-1"
        style={{ fontSize: "var(--text-xs)" }}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        Select Coins ({selectedCoins.length}/{maxSelection})
        <svg className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-64 card p-0 z-50 shadow-lg"
          style={{ maxHeight: "360px", overflow: "hidden" }}
        >
          {/* Search Input */}
          <div className="p-2 border-b" style={{ borderColor: "var(--border-color)" }}>
            <input
              type="text"
              placeholder="Search coins..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-2 py-1.5 rounded text-primary bg-tertiary"
              style={{ fontSize: "var(--text-xs)", border: "1px solid var(--border-color)" }}
              autoFocus
            />
          </div>

          {/* Selection count and Clear All */}
          <div className="px-3 py-2 flex items-center justify-between border-b" style={{ fontSize: "var(--text-xs)", borderColor: "var(--border-color)" }}>
            <span className="text-muted">{selectedCoins.length} of {maxSelection} selected</span>
            {selectedCoins.length > 0 && (
              <button
                onClick={() => onSelectionChange([])}
                className="text-accent hover:underline"
                style={{ fontSize: "var(--text-xs)" }}
              >
                Clear All
              </button>
            )}
          </div>

          {/* Coin List */}
          <div style={{ maxHeight: "260px", overflowY: "auto" }}>
            {sortedCoins.map((coin) => {
              const isSelected = selectedCoins.includes(coin.id);
              const isDisabled = !isSelected && selectedCoins.length >= maxSelection;

              return (
                <button
                  key={coin.id}
                  onClick={() => !isDisabled && toggleCoin(coin.id)}
                  disabled={isDisabled}
                  className={`w-full px-3 py-2 flex items-center gap-2 text-left transition-colors ${
                    isDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-tertiary cursor-pointer"
                  } ${isSelected ? "bg-tertiary" : ""}`}
                  style={{ fontSize: "var(--text-xs)" }}
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      isSelected ? "bg-[var(--accent)] border-[var(--accent)]" : ""
                    }`}
                    style={{ borderColor: isSelected ? "var(--accent)" : "var(--border-color)" }}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  {coin.image && (
                    <img src={coin.image} alt={coin.name} className="w-4 h-4 rounded-full flex-shrink-0" />
                  )}
                  <span className="text-secondary font-medium uppercase" style={{ width: "40px" }}>
                    {coin.symbol}
                  </span>
                  <span className="text-primary truncate flex-1">{coin.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

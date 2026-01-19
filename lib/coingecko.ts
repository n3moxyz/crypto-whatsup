export interface CoinData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
}

export interface DisplayItem {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price: number | string;
  price_change_percentage_24h: number | null;
  isRatio?: boolean;
}

export interface TopMover {
  symbol: string;
  name: string;
  change: string;
  price: number;
}

const COINGECKO_API = "https://api.coingecko.com/api/v3";

// Default coins to show (BTC, ETH, SOL, BNB, XRP)
const DEFAULT_COIN_IDS = ["bitcoin", "ethereum", "solana", "binancecoin", "ripple"];

// Known stablecoin IDs to filter out
const STABLECOIN_IDS = [
  "tether", "usd-coin", "dai", "trueusd", "paxos-standard", "binance-usd",
  "frax", "usdd", "gemini-dollar", "pax-dollar", "first-digital-usd",
  "paypal-usd", "ethena-usde", "usual-usd", "fdusd", "ondo-us-dollar-yield"
];

// Fetch top 100 coins for the selector (excluding stablecoins)
export async function fetchTop50Coins(): Promise<CoinData[]> {
  const response = await fetch(
    `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h,7d`,
    {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    }
  );

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`);
  }

  const coins: CoinData[] = await response.json();
  // Filter out stablecoins
  return coins.filter(coin => !STABLECOIN_IDS.includes(coin.id));
}

// Fetch top 100 coins (used for gainers/losers)
export async function fetchTop100Coins(): Promise<CoinData[]> {
  const response = await fetch(
    `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h,7d`,
    {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    }
  );

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`);
  }

  return response.json();
}

// Fetch top 300 coins (used for selector and prices)
export async function fetchTop300Coins(): Promise<CoinData[]> {
  // CoinGecko allows max 250 per page, so fetch in batches
  const [page1, page2] = await Promise.all([
    fetch(
      `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=150&page=1&sparkline=false&price_change_percentage=24h,7d`,
      { headers: { Accept: "application/json" }, next: { revalidate: 300 } }
    ),
    fetch(
      `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=150&page=2&sparkline=false&price_change_percentage=24h,7d`,
      { headers: { Accept: "application/json" }, next: { revalidate: 300 } }
    ),
  ]);

  if (!page1.ok || !page2.ok) {
    throw new Error(`CoinGecko API error: ${page1.status || page2.status}`);
  }

  const [coins1, coins2] = await Promise.all([page1.json(), page2.json()]);
  return [...coins1, ...coins2];
}

// Fetch specific coins by IDs
export async function fetchSpecificCoins(coinIds?: string[]): Promise<CoinData[]> {
  const ids = coinIds && coinIds.length > 0 ? coinIds.join(",") : DEFAULT_COIN_IDS.join(",");

  const response = await fetch(
    `${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=24h,7d`,
    {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    }
  );

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`);
  }

  return response.json();
}

// Get top gainers and losers from top 100
export function getTopMovers(coins: CoinData[]): { gainers: TopMover[]; losers: TopMover[] } {
  const sorted = [...coins].sort(
    (a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h
  );

  const gainers = sorted
    .filter((c) => c.price_change_percentage_24h > 0)
    .slice(0, 5)
    .map((c) => ({
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      change: `+${c.price_change_percentage_24h.toFixed(1)}%`,
      price: c.current_price,
    }));

  const losers = sorted
    .filter((c) => c.price_change_percentage_24h < 0)
    .slice(-5)
    .reverse()
    .map((c) => ({
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      change: `${c.price_change_percentage_24h.toFixed(1)}%`,
      price: c.current_price,
    }));

  return { gainers, losers };
}

export function getDisplayItems(coins: CoinData[], selectedIds?: string[]): DisplayItem[] {
  // If specific IDs are provided, filter and order by those
  let displayCoins = coins;

  if (selectedIds && selectedIds.length > 0) {
    displayCoins = selectedIds
      .map((id) => coins.find((c) => c.id === id))
      .filter((c): c is CoinData => c !== undefined);
  }

  // Check if we have both BTC and ETH for ratio calculation
  const btc = coins.find((c) => c.symbol === "btc");
  const eth = coins.find((c) => c.symbol === "eth");
  const showRatio = selectedIds?.includes("bitcoin") && selectedIds?.includes("ethereum");

  const items: DisplayItem[] = displayCoins.map((coin) => ({
    id: coin.id,
    symbol: coin.symbol.toUpperCase(),
    name: coin.name,
    image: coin.image,
    current_price: coin.current_price,
    price_change_percentage_24h: coin.price_change_percentage_24h,
  }));

  // Add ETH/BTC ratio if both are selected
  if (showRatio && btc && eth) {
    const ethBtcRatio = eth.current_price / btc.current_price;
    const btcIndex = items.findIndex((i) => i.id === "bitcoin");
    const ethIndex = items.findIndex((i) => i.id === "ethereum");
    const insertIndex = Math.max(btcIndex, ethIndex) + 1;

    items.splice(insertIndex, 0, {
      id: "ethbtc",
      symbol: "ETH/BTC",
      name: "ETH/BTC Ratio",
      current_price: ethBtcRatio.toFixed(5),
      price_change_percentage_24h: null,
      isRatio: true,
    });
  }

  return items;
}

function formatBtcPrice(price: number): string {
  const rounded = Math.round(price / 1000);
  return `$${rounded}k`;
}

function formatEthPrice(price: number): string {
  const rounded = Math.round(price / 100) / 10;
  return `$${rounded}k`;
}

function formatSolPrice(price: number): string {
  const rounded = Math.round(price / 10) * 10;
  return `$${rounded}`;
}

export function formatPriceData(coins: CoinData[]): string {
  const btc = coins.find((c) => c.symbol === "btc");
  const eth = coins.find((c) => c.symbol === "eth");
  const sol = coins.find((c) => c.symbol === "sol");

  let formatted = "## Current Prices\n\n";

  if (btc) {
    formatted += `**Bitcoin (BTC)**: ${formatBtcPrice(btc.current_price)}\n`;
  }

  if (eth) {
    formatted += `**Ethereum (ETH)**: ${formatEthPrice(eth.current_price)}\n`;
  }

  if (sol) {
    formatted += `**Solana (SOL)**: ${formatSolPrice(sol.current_price)}\n`;
  }

  if (btc && eth) {
    const ethBtcRatio = eth.current_price / btc.current_price;
    formatted += `**ETH/BTC Ratio**: ${ethBtcRatio.toFixed(4)}\n`;
  }

  return formatted;
}

export function getMarketSummary(coins: CoinData[]): {
  btcPrice: number;
  ethPrice: number;
  solPrice: number;
  ethBtcRatio: number;
  btcChange24h: number;
  ethChange24h: number;
  solChange24h: number;
} {
  const btc = coins.find((c) => c.symbol === "btc");
  const eth = coins.find((c) => c.symbol === "eth");
  const sol = coins.find((c) => c.symbol === "sol");

  const btcPrice = btc?.current_price || 0;
  const ethPrice = eth?.current_price || 0;
  const solPrice = sol?.current_price || 0;

  return {
    btcPrice,
    ethPrice,
    solPrice,
    ethBtcRatio: btcPrice > 0 ? ethPrice / btcPrice : 0,
    btcChange24h: btc?.price_change_percentage_24h || 0,
    ethChange24h: eth?.price_change_percentage_24h || 0,
    solChange24h: sol?.price_change_percentage_24h || 0,
  };
}

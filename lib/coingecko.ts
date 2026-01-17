export interface CoinData {
  id: string;
  symbol: string;
  name: string;
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
  current_price: number | string;
  price_change_percentage_24h: number | null;
  isRatio?: boolean;
}

const COINGECKO_API = "https://api.coingecko.com/api/v3";
const COIN_IDS = "bitcoin,ethereum,solana,binancecoin,ripple";

export async function fetchSpecificCoins(): Promise<CoinData[]> {
  const response = await fetch(
    `${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${COIN_IDS}&order=market_cap_desc&sparkline=false&price_change_percentage=24h,7d`,
    {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 60 },
    }
  );

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

export function getDisplayItems(coins: CoinData[]): DisplayItem[] {
  const btc = coins.find(c => c.symbol === "btc");
  const eth = coins.find(c => c.symbol === "eth");
  const sol = coins.find(c => c.symbol === "sol");
  const bnb = coins.find(c => c.symbol === "bnb");
  const xrp = coins.find(c => c.symbol === "xrp");

  const ethBtcRatio = btc && eth ? eth.current_price / btc.current_price : 0;

  const items: DisplayItem[] = [];

  if (btc) {
    items.push({
      id: "bitcoin",
      symbol: "BTC",
      name: "Bitcoin",
      current_price: btc.current_price,
      price_change_percentage_24h: btc.price_change_percentage_24h,
    });
  }

  if (eth) {
    items.push({
      id: "ethereum",
      symbol: "ETH",
      name: "Ethereum",
      current_price: eth.current_price,
      price_change_percentage_24h: eth.price_change_percentage_24h,
    });
  }

  if (sol) {
    items.push({
      id: "solana",
      symbol: "SOL",
      name: "Solana",
      current_price: sol.current_price,
      price_change_percentage_24h: sol.price_change_percentage_24h,
    });
  }

  // ETH/BTC ratio
  items.push({
    id: "ethbtc",
    symbol: "ETH/BTC",
    name: "ETH/BTC Ratio",
    current_price: ethBtcRatio.toFixed(4),
    price_change_percentage_24h: null,
    isRatio: true,
  });

  if (bnb) {
    items.push({
      id: "binancecoin",
      symbol: "BNB",
      name: "BNB",
      current_price: bnb.current_price,
      price_change_percentage_24h: bnb.price_change_percentage_24h,
    });
  }

  if (xrp) {
    items.push({
      id: "ripple",
      symbol: "XRP",
      name: "XRP",
      current_price: xrp.current_price,
      price_change_percentage_24h: xrp.price_change_percentage_24h,
    });
  }

  return items;
}

function formatBtcPrice(price: number): string {
  // Round to nearest thousand, display as $XXk
  const rounded = Math.round(price / 1000);
  return `$${rounded}k`;
}

function formatEthPrice(price: number): string {
  // Round to nearest hundred, display as $X.Xk
  const rounded = Math.round(price / 100) / 10;
  return `$${rounded}k`;
}

function formatSolPrice(price: number): string {
  // Round to nearest ten
  const rounded = Math.round(price / 10) * 10;
  return `$${rounded}`;
}

export function formatPriceData(coins: CoinData[]): string {
  const btc = coins.find(c => c.symbol === "btc");
  const eth = coins.find(c => c.symbol === "eth");
  const sol = coins.find(c => c.symbol === "sol");

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
  const btc = coins.find(c => c.symbol === "btc");
  const eth = coins.find(c => c.symbol === "eth");
  const sol = coins.find(c => c.symbol === "sol");

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

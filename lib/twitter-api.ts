const TWITTER_API_BASE = "https://api.twitterapi.io/twitter";

interface RawTweet {
  id: string;
  text: string;
  createdAt: string;
  likeCount: number;
  retweetCount: number;
  viewCount: number;
  author: {
    userName: string;
    name: string;
    followers: number;
  };
  url?: string;
}

export interface RankedTweet {
  id: string;
  text: string;
  createdAt: string;
  likes: number;
  retweets: number;
  views: number;
  username: string;
  displayName: string;
  followers: number;
  url: string;
  score: number;
}

interface TwitterSearchResponse {
  tweets: RawTweet[];
  has_next_page?: boolean;
}

// Trusted accounts mirrored from Grok's credible source list (lib/grok.ts)
// Grouped into 4 queries to stay within query length limits
const TRUSTED_ACCOUNT_GROUPS = [
  // NEWS + DATA — market-moving headlines and on-chain data
  [
    "DeItaone", "tier10k", "WatcherGuru", "DocumentingBTC", "unusual_whales",
    "Cointelegraph", "TheBlock__", "CoinDesk", "WuBlockchain", "whale_alert",
    "DLNews", "lookonchain", "EmberCN", "cryptoquant_com", "glassnode",
    "intotheblock", "tokenterminal", "DuneAnalytics",
  ],
  // ANALYSTS + some TRADERS — market interpretation
  [
    "52kskew", "CryptoCapo_", "ColdBloodShill", "HsakaTrades", "SmartContracter",
    "Route2FI", "milesdeutscher", "thedefiedge", "Delphi_Digital", "MessariCrypto",
    "CryptoHayes", "inversebrah", "CryptoDonAlt", "lightcrypto", "Rewkang",
  ],
  // Remaining TRADERS + MACRO — positioning and macro context
  [
    "CL207", "GCRClassic", "Pentosh1", "TheCryptoDog", "AltcoinPsycho",
    "blknoiz06", "MacroAlf", "fejau_inc", "Zhu_Su", "KyleSamani",
    "nic__carter", "cburniske", "TuurDemeester", "RaoulGMI", "LynAldenContact",
    "punk6529", "Travis_Kling",
  ],
  // FOUNDERS + CT — industry leaders and crypto twitter influencers
  [
    "VitalikButerin", "brian_armstrong", "cz_binance", "cdixon", "jessepollak",
    "balajis", "aantonop", "rleshner", "ryanberckmans", "MikeIppolito_",
    "cobie", "CryptoCobain", "DegenSpartan", "Darrenlautf", "IamNomad",
    "BarrySilbert", "APompliano", "scottmelker", "AriDavidPaul", "Zagabond",
    "ledgerstatus",
  ],
];

function buildFromQuery(accounts: string[]): string {
  return `(${accounts.map(a => `from:${a}`).join(" OR ")})`;
}

const QUERIES = TRUSTED_ACCOUNT_GROUPS.map(group => ({
  query: buildFromQuery(group),
  queryType: "Latest" as const,
}));

const FOLLOWER_TIERS = [
  { min: 500_000, bonus: 3 },
  { min: 100_000, bonus: 2 },
  { min: 50_000, bonus: 1 },
] as const;

function scoreTweet(tweet: RawTweet): number {
  const likeScore = Math.log(tweet.likeCount + 1) * 2;
  const rtScore = Math.log(tweet.retweetCount + 1) * 1.5;
  const viewScore = Math.log((tweet.viewCount || 0) + 1) * 0.5;
  const followerBonus = FOLLOWER_TIERS.find(t => tweet.author.followers >= t.min)?.bonus ?? 0;
  return likeScore + rtScore + viewScore + followerBonus;
}

async function searchTweets(
  apiKey: string,
  query: string,
  queryType: "Top" | "Latest"
): Promise<RawTweet[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const params = new URLSearchParams({ query, queryType });
    const response = await fetch(`${TWITTER_API_BASE}/tweet/advanced_search?${params}`, {
      headers: { "X-API-Key": apiKey },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`twitterapi.io search error: ${response.status}`);
      return [];
    }

    const data: TwitterSearchResponse = await response.json();
    return data.tweets || [];
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      console.error("twitterapi.io search timed out");
    } else {
      console.error("twitterapi.io search error:", error);
    }
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchCryptoTweets(): Promise<RankedTweet[]> {
  const apiKey = process.env.TWITTER_API_KEY;

  if (!apiKey) {
    return [];
  }

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

  // Run all 3 queries in parallel — individual failures don't block others
  const results = await Promise.allSettled(
    QUERIES.map(q => searchTweets(apiKey, q.query, q.queryType))
  );

  const allTweets: RawTweet[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allTweets.push(...result.value);
    }
  }

  // Deduplicate by tweet ID
  const seen = new Set<string>();
  const unique = allTweets.filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  // Filter: min 30 chars, within 48h
  const filtered = unique.filter(t => {
    if (t.text.length < 30) return false;
    const tweetDate = new Date(t.createdAt);
    return tweetDate >= cutoff;
  });

  // Score and rank
  const scored = filtered
    .map(t => ({ tweet: t, score: scoreTweet(t) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  return scored.map(({ tweet, score }) => ({
    id: tweet.id,
    text: tweet.text.slice(0, 280),
    createdAt: tweet.createdAt,
    likes: tweet.likeCount,
    retweets: tweet.retweetCount,
    views: tweet.viewCount || 0,
    username: tweet.author.userName,
    displayName: tweet.author.name,
    followers: tweet.author.followers,
    url: tweet.url || `https://x.com/${tweet.author.userName}/status/${tweet.id}`,
    score,
  }));
}

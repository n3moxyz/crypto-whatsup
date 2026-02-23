# FOR[ET].md - Crypto What's Up

*A behind-the-scenes look at building a market intelligence app that actually thinks*

---

## The Big Picture: What Is This Thing?

Imagine having a financial analyst friend who never sleeps, constantly scrolls Crypto Twitter, tracks every price movement, and can explain what's happening in plain English whenever you ask. That's what we built here.

**Crypto - What's Up?** is a market intelligence app that:
1. Fetches real-time cryptocurrency prices
2. Scans the last 48 hours of Crypto Twitter via Grok (X's AI)
3. Synthesizes everything through Claude to generate actionable insights
4. Delivers reports via an interactive web interface

It's not just a price tracker. It's a *reasoning engine* that connects the dots between market movements and the narratives driving them.

---

## The Architecture: A Tale of Three AIs

Here's where it gets interesting. This project uses **three different AI systems**, each doing what it does best:

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  CoinGecko   │  │     Grok     │  │ twitterapi   │  │    Claude    │
│ (Price Data) │  │ (AI Interp.) │  │ (Raw Tweets) │  │  (Analysis)  │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │                 │
       │  Raw prices     │  Narratives     │  Ground truth   │  Synthesis
       └─────────────────┼─────────────────┼─────────────────┘
                         │                 │
                    ┌────▼─────────────────▼────┐
                    │       Next.js API         │
                    │         Routes            │
                    └────────────┬──────────────┘
                                 │
                   ┌─────────────┼─────────────┐
                   │                           │
             ┌─────▼─────┐               ┌─────▼─────┐
             │    Web    │               │   Cache   │
             │    UI     │               │  (24hr)   │
             └───────────┘               └───────────┘
```

### Why Three AIs + Raw Data?

**CoinGecko** isn't AI—it's a data API. But it's the foundation. You can't analyze the market without knowing where prices actually are.

**Grok** has a superpower: it can search X/Twitter in real-time. No other AI can do this. When Bitcoin dumps 5%, Grok knows whether it's because of a Fed announcement, a whale wallet moving coins, or just weekend liquidity. It's our "ears on the ground."

**twitterapi.io** is the fact-checker. It provides raw, real tweets with verified URLs and engagement data. Grok interprets the narrative; twitterapi.io proves it with actual evidence. This solves Grok's tendency to hallucinate source URLs.

**Claude** is the brain. It takes cold numbers from CoinGecko, hot takes from Grok, and raw evidence from twitterapi.io, then produces measured analysis. Claude's job is to be *skeptical*—to cross-reference claims against real tweets and explain the "why" behind price movements.

---

## The Codebase: How Everything Connects

### Directory Structure (The Map)

```
crypto-whatsup/
├── app/
│   ├── api/                          # All the backend magic
│   │   ├── whatsup/route.ts          # Main market summary endpoint
│   │   ├── whatsup/followup/route.ts # Interactive Q&A
│   │   ├── prices/route.ts           # CoinGecko integration
│   │   └── generate/route.ts         # Weekly reports
│   ├── layout.tsx                    # App shell with theme
│   └── page.tsx                      # The main UI + page layout
├── components/
│   ├── WhatsUpDisplay.tsx            # Market summary with follow-up chat
│   ├── EthBtcChart.tsx               # ETH/BTC ratio chart with level legend
│   ├── TopMovers.tsx                 # Top gainers/losers with tier toggle
│   ├── FeaturePreview.tsx            # Landing page preview (pre-interaction)
│   └── ...                           # Supporting cast
├── lib/
│   ├── claude.ts                     # Claude integration
│   ├── grok.ts                       # Grok integration (AI interpretation)
│   ├── twitter-api.ts                # twitterapi.io (raw verified tweets)
│   ├── coingecko.ts                  # Price fetching
│   └── cache.ts                      # 24-hour caching
└── samples/                          # Reference reports for style
```

### The Data Flow: Following a Request

Let's trace what happens when you click "What's Up?":

**Step 1: The Request**
```typescript
// WhatsUpButton.tsx clicks, hitting:
const response = await fetch('/api/whatsup');
```

**Step 2: Parallel Fetching** (This is key!)
```typescript
// route.ts - We don't wait for one then the other
const [priceData, grokIntel] = await Promise.all([
  fetchPrices(['bitcoin', 'ethereum', 'solana', 'binancecoin', 'ripple']),
  fetchGrokIntelligence()  // Last 48 hours of Crypto Twitter
]);
```

**Step 3: The Grok Query**
Grok searches X/Twitter with a carefully crafted prompt:
- Only credible sources (analysts, journalists, on-chain researchers)
- Last 48 hours only
- Specific themes: regulatory, macro, ETF flows, on-chain activity
- Must include source URLs for everything claimed

**Step 4: Claude Synthesis**
Now Claude gets both datasets and produces:
```json
{
  "bullets": [
    {
      "main": "BTC testing $91k resistance...",
      "subPoints": [{ "text": "Evidence...", "sourceUrl": "x.com/..." }]
    }
  ],
  "conclusion": "Bullish short-term, watching Fed...",
  "sentiment": "bullish"
}
```

**Step 5: Preloading Elaborations**
Here's a clever trick—before the user even asks "tell me more," we fetch all explanations in parallel:
```typescript
// Pre-fetch all "Tell me more" content at once
const elaborations = await Promise.all(
  bullets.map(bullet => fetchElaboration(bullet))
);
```

This makes the UI feel instant when users click to expand.

---

## The Technologies: Why These Choices?

### Next.js 16 (App Router)

**Why?** API routes and frontend in one codebase. Vercel deploys it beautifully. TypeScript throughout.

**The gotcha we learned:** Serverless functions on Vercel have cold starts. Our in-memory cache disappears when functions restart. Solution: We use **both** memory cache AND file cache (`/tmp` directory).

### Tailwind CSS 4.0

**Why?** Rapid prototyping. Dark mode with a single class toggle. CSS variables for theming.

**The lesson:** Tailwind 4.0 uses `@layer` directives differently. We had to restructure our `globals.css` to make custom component styles work.

---

## The Bugs We Fought (And Won)

### Bug #1: The Sentiment Paradox

**The problem:** Our API returned `sentiment: "neutral"` even when the conclusion said "strongly bullish." Users were confused.

**The investigation:** We were trusting Claude's raw sentiment field. But Claude sometimes hedges with "neutral" even when the analysis is clearly directional.

**The fix:** We extract sentiment from the conclusion text, not the sentiment field:
```typescript
function deriveSentimentFromConclusion(conclusion: string): string {
  const lower = conclusion.toLowerCase();
  if (lower.includes('bullish')) return 'bullish';
  if (lower.includes('bearish')) return 'bearish';
  return 'neutral';
}
```

**The lesson:** Never trust a single field when you have corroborating data. Cross-reference.

---

### Bug #2: The Purple Price Problem

**The problem:** Prices were supposed to be styled purple, like "BTC $91k" in purple. But sometimes random numbers got highlighted: "$891k" or "$50".

**The investigation:** Our regex was too greedy. It matched any dollar amount.

**The fix:** Only match prices when preceded by a ticker symbol:
```typescript
// Bad: /$\d+k?/g  — catches everything
// Good: /(?:BTC|ETH|SOL|BNB|XRP)\s*\$[\d,.]+[kKmMbB]?/g
```

**The lesson:** Regex is powerful but dangerous. Test with edge cases. Always ask "what could this accidentally match?"

---

### Bug #3: The Grok Hallucination

**The problem:** Sometimes Grok would claim there were "major regulatory developments" when there weren't. Empty arrays became fabricated news.

**The investigation:** When Grok had no data for a theme, it sometimes filled the gap with plausible-sounding nonsense.

**The fix:** Defensive programming with explicit guards:
```typescript
if (!grokResponse.themes || grokResponse.themes.length === 0) {
  // Return empty, don't synthesize
  return { themes: [], disclaimer: "No significant developments detected" };
}
```

**The lesson:** AI hallucination is a feature, not a bug—until you ship it to users. Always validate AI outputs before using them.

---

### Bug #4: The twitterapi.io Field Name Mismatch

**The problem:** twitterapi.io returned 429 errors, and even when it worked, follower counts would have been `undefined`.

**The investigation:** The API docs (and Claude's planning) assumed `author.followersCount`, but the actual API response uses `author.followers`. We caught this by curling the API directly and inspecting the response JSON.

**The fix:** Changed the `RawTweet` interface from `followersCount` to `followers` to match the real API response.

**The lesson:** Never trust API documentation (or AI-generated interfaces) without testing against the real response. Always `curl` the endpoint and inspect actual field names before writing your types.

---

---

## The Landing Page: First Impressions Matter

When we first built the app, visitors landed on a page with prices, a mysterious "Actions" heading, and a lot of empty space. Not great for first-time users who have no idea what the app does.

### The Redesign: Three Layers

We replaced the generic layout with a purpose-driven flow:

**1. Hero CTA Card** — Replaces the old "Actions" section. Clear heading ("Get Your Market Briefing"), a two-line description of what the app actually does, and the "What's Up?" button front and center. No mystery, no hunting.

**2. Feature Preview** — A grid of three cards (Market Bullets, Follow-Up Chat, Top Movers) explaining what you'll get, plus a faded mock preview of sample output with a gradient fade. This fills the empty void and sets expectations. It disappears once you click "What's Up?" and real data loads.

**3. Consolidated Prices Section** — The ETH/BTC chart and Top Movers used to be separate sections scattered down the page. Now they're collapsible sub-sections nested inside Current Prices, keeping everything organized under one roof. Both are collapsed by default with "Show/Collapse" toggles.

### The ETH/BTC Level Legend

Instead of showing a single label like "Cycle lows territory," we now show all five levels stacked vertically. The active level (based on the live ratio) is highlighted with full opacity and a colored dot (green for bullish levels, red for bearish). The other levels are dimmed to 35% opacity. You can always see where you sit in the full scale at a glance.

### Admin Mode: Hidden in Plain Sight

The app has internal features (Archive, Generate Update, Report section) that are password-gated but shouldn't be visible to public users at all. Instead of hiding them behind a settings page or URL parameter (which could leak), we use a keyboard shortcut that toggles "admin mode."

The state is persisted in localStorage under an obscure key, so it survives refreshes. When off (the default), those elements aren't rendered at all—not hidden with CSS, not faded, just absent from the DOM. No trace they exist.

**The lesson:** For internal tools on public-facing apps, "hidden" is better than "locked." A locked door invites curiosity. An invisible door doesn't.

---

## Patterns That Good Engineers Use

### Pattern 1: Parallel by Default

Bad:
```typescript
const prices = await fetchPrices();
const intel = await fetchIntel();
const fx = await fetchFxRates();
// Total time: prices + intel + fx
```

Good:
```typescript
const [prices, intel, fx] = await Promise.all([
  fetchPrices(),
  fetchIntel(),
  fetchFxRates()
]);
// Total time: max(prices, intel, fx)
```

We saved 4-6 seconds on every request by parallelizing.

### Pattern 2: Cache Layers

Our caching strategy has three layers:
1. **Memory cache** (fastest, survives between requests in warm functions)
2. **File cache** (persists across cold starts on Vercel)
3. **Stale-while-revalidate** (serve old data while fetching fresh)

```typescript
const cached = memoryCached ?? fileCached;
if (cached && !isExpired(cached)) {
  return cached;
}
// Fetch fresh, update both caches
```

### Pattern 3: Defensive JSON Parsing

AI outputs are unpredictable. They might have markdown code fences, extra text, or invalid JSON.

```typescript
function parseAIResponse(text: string) {
  // Try to find JSON in the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found');

  // Clean up common issues
  let cleaned = jsonMatch[0]
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .replace(/,\s*}/g, '}');  // Trailing commas

  return JSON.parse(cleaned);
}
```

### Pattern 4: Prompt Engineering with Examples

Don't just tell Claude what you want. Show it:

```typescript
const systemPrompt = `
You are a market analyst. Be specific and data-driven.

BAD: "The market is showing strength."
GOOD: "BTC has held above $90k despite heavy selling pressure,
       with $2.3B in spot buying countering $1.8B in futures liquidations."

BAD: "This could affect prices."
GOOD: "This typically causes 5-15% corrections as leveraged
       positions unwind over 24-48 hours."
`;
```

### Pattern 5: Extract When Reused, Nest When Related

When Top Movers lived inside `WhatsUpDisplay`, it was tied to the market summary lifecycle—invisible until you clicked "What's Up?". But top movers are price data, not analysis. Moving it to its own `TopMovers.tsx` component and rendering it in the prices section meant it loads with prices, not with the AI summary.

The rule: if a piece of UI belongs to a different *data lifecycle* than its parent component, extract it. If it belongs to the same section visually, nest it (like ETH/BTC chart inside the prices card) rather than making it a standalone section.

---

## Best Practices We Learned

### 1. Environment Variables: Keep Secrets Secret

We use `.env.local` for all sensitive data:
```env
ANTHROPIC_API_KEY=sk-ant-...
XAI_API_KEY=xai-...
ADMIN_BYPASS_TOKEN=...
```

The bypass token lets us test without rate limits. Never commit these.

### 2. Rate Limiting: Protect Yourself

Our simple but effective rate limiter:
```typescript
const limits = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = limits.get(ip);

  if (!entry || now > entry.resetTime) {
    limits.set(ip, { count: 1, resetTime: now + 60000 });
    return true;
  }

  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}
```

10 requests per minute per IP. Simple, effective, prevents abuse.

### 3. Error Messages: Be Helpful

Bad:
```json
{ "error": "Failed" }
```

Good:
```json
{
  "error": "Rate limit exceeded",
  "details": "You've made 10 requests in the last minute. Please wait 45 seconds.",
  "retryAfter": 45
}
```

### 4. Loading States: Manage Expectations

Our "What's Up" button shows animated loading messages:
```
"Scanning Crypto Twitter..."
"Crunching the numbers..."
"Connecting the dots..."
"Almost there..."
```

With a progress countdown (45 seconds estimated). Users don't mind waiting when they know what's happening.

---

---

## Price Card Sparklines

Each price card now shows a tiny 7-day sparkline chart—a 60x20px SVG polyline rendered inline. The data comes from CoinGecko's `sparkline_in_7d` field (168 hourly data points), enabled only on `fetchSpecificCoins()` for the 5-11 displayed coins. We deliberately keep it OFF for `fetchTop100/300` calls used by the coin selector and top movers, since those would bloat the response for no visual benefit.

The sparkline color follows the 24h change: green if positive, red if negative. No axes, no hover, no charting library—just the line shape. It gives instant visual context for whether a coin is trending up or down over the week.

---

## Auto-Refresh: Keeping Prices Fresh

Prices used to go stale the moment they loaded. Now a 60-second interval auto-refreshes price data (and sparklines) without touching the AI summary or report—those cost API credits and take 30+ seconds.

The refresh button shows a countdown ("Refresh 45s") so users know when the next update is coming. Manual clicks reset the timer. The interval skips if a fetch is already in progress, preventing race conditions.

**Key implementation detail:** We use a `useRef` to track loading state inside the interval callback, since `setInterval` closures capture stale state. The ref stays in sync via a `useEffect`.

---

## Mobile Polish

Several targeted improvements for small screens:
- **EthBtcChart**: Axis font bumped from 9px to 10px for readability. Tooltip clamped to 10-90% of chart width to prevent overflow. Timeframe buttons enlarged for touch. Level legend hidden on mobile (too cramped in the header).
- **TopMovers**: Tier buttons get `overflow-x-auto` + `flex-shrink-0` so they scroll horizontally instead of wrapping.
- **WhatsUpDisplay**: Chat input padding increased for comfortable touch typing. Suggested question buttons enlarged. Placeholder text shortened.
- **Price cards**: `truncate` on price text prevents long decimals from breaking layout.

---

## API Cost Protection: Defense in Depth

Going public at `cryptowhatsup.cc` meant anyone could hit our API endpoints. We added two layers of protection:

**Layer 1: Per-IP Rate Limiting** — The `/api/whatsup` endpoint already had `checkRateLimit()` (10 req/min per IP), but the `/api/whatsup/followup` endpoint was wide open. Each followup call costs Claude API credits. We applied the same rate limiter to both endpoints, sharing the in-memory store.

**Layer 2: Daily Global Budget Cap** — Per-IP limits don't stop distributed abuse (100 different IPs, each under limit). So we added a global daily counter in `lib/dailyBudget.ts`. Default: 200 API-costing requests per day, configurable via `DAILY_API_BUDGET` env var. Resets at midnight UTC. In-memory counter means cold starts reset it — acceptable, since it errs on allowing more rather than blocking legitimate users.

The budget only counts actual API calls, not cache hits. The whatsup endpoint checks the budget *after* the cache check, so cached responses flow freely. The followup endpoint checks at the top since every call hits the Claude API.

**The lesson:** Cost protection needs multiple layers. Rate limiting stops individual abuse; budget caps stop distributed abuse. Neither alone is sufficient.

---

## SEO Meta Tags: Social Link Previews

Sharing `cryptowhatsup.cc` on X/Discord/Slack showed a blank preview — no title, no description, just a bare URL. We added Open Graph and Twitter Card meta tags via Next.js Metadata API in `layout.tsx`. Text-only for now (no og:image), but even title + description dramatically improves click-through when shared socially.

---

## Verified Tweet Intelligence: Giving Claude Ground Truth

### The Problem: Grok Hallucinated URLs

Grok is great at interpreting Crypto Twitter narratives, but it has a weakness: it fabricates source URLs. It'll confidently provide `https://x.com/lookonchain/status/1234567890` — a URL that doesn't exist. This means our "sourced claims" sometimes linked to dead ends.

We couldn't just drop Grok — its AI interpretation of overall sentiment and thematic analysis is genuinely useful. But we needed a way to verify its claims against reality.

### The Solution: twitterapi.io as Ground Truth

We added a new data source: **twitterapi.io**, which returns raw, real tweets with actual engagement metrics and real URLs. The pipeline became:

```
CoinGecko (prices) + Grok (AI interpretation) + twitterapi.io (real tweets)
                              ↓
                    Claude (synthesis + cross-referencing)
```

Four parallel search queries pull exclusively from **71 trusted accounts** — the same credible source list in Grok's prompt (`lib/grok.ts`). No keyword-based queries, no random accounts, no spam:

| Query | Accounts | Focus |
|-------|----------|-------|
| 1 | NEWS + DATA (18) | lookonchain, whale_alert, DeItaone, CoinDesk, glassnode, etc. |
| 2 | ANALYSTS + TRADERS (15) | CryptoHayes, HsakaTrades, milesdeutscher, etc. |
| 3 | TRADERS + MACRO (17) | Pentosh1, MacroAlf, RaoulGMI, LynAldenContact, etc. |
| 4 | FOUNDERS + CT (21) | VitalikButerin, cobie, brian_armstrong, etc. |

We initially tried keyword-based queries (e.g. "crypto ETF SEC" with `min_faves:50`) but these surfaced spam and scam accounts. Switching to account-based queries ensures every tweet comes from a vetted source. The account list is maintained in one place (`lib/twitter-api.ts`) mirroring Grok's prompt.

Tweets are deduplicated, filtered (min 30 chars, within 48h), scored by engagement + follower tier, and the top 15 are sent to Claude as a `RAW VERIFIED TWEETS` section.

### The Scoring Formula

```
score = log(likes+1)*2 + log(RTs+1)*1.5 + log(views+1)*0.5 + follower_tier_bonus
```

Follower tier bonuses: 500K+ = 3, 100K+ = 2, 50K+ = 1. This naturally surfaces high-signal tweets from credible accounts.

### The Prompt Engineering

Claude's system prompt now includes instructions to:
- **Prefer** real tweet URLs over Grok-provided URLs
- Be **more skeptical** of Grok claims not supported by any real tweet
- **Trust raw tweets** when they contradict Grok
- Use engagement metrics to gauge narrative strength

### Cost & Performance

- **Cost**: $0.056 per call (4 searches), ~$11.20/day worst case at 200 requests/day
- **Latency**: 1-3s, well under Grok's 5-15s — zero impact on total response time
- **Graceful degradation**: No API key? Returns empty. Timeout? Returns empty. Individual query fails? `Promise.allSettled` keeps the others.

### The Lesson

When working with AI-interpreted data, always try to provide the AI analyst with raw source material to cross-reference against. Grok tells Claude *what's happening*; twitterapi.io shows Claude *the actual evidence*. Together they're much stronger than either alone.

---

## Things I Wish I'd Known Earlier

### 1. Vercel Hobby Plan Limits

The free tier has a 10-second function timeout and limited cron frequency (once per day). We designed our caching around this constraint.

**The workaround:** 24-hour cache expiry. If you need fresher data, you'll need Vercel Pro.

### 2. CoinGecko Rate Limits

The free CoinGecko API has tight rate limits. We learned to:
- Batch requests (up to 50 coins per call)
- Cache aggressively (5-minute minimum)
- Filter stablecoins to reduce unnecessary fetches

### 3. AI Temperature Settings

For analysis, use low temperature (0.3). You want consistent, factual output.

For creative writing (like report prose), you can go higher (0.7).

We use 0.3 for Grok (accuracy matters for news) and Claude's analysis, but 0.7 for the "tell me more" elaborations where we want engaging explanations.

---

## The Sample Reports: Teaching by Example

The `/samples` directory contains reference reports. When Claude generates a weekly update, it reads these to match the style:

```
samples/
├── 15jan26.txt
├── 08jan26.txt
├── 01jan26.txt
└── ...
```

Naming format: `DDmonYY.txt` (e.g., 15jan26 = January 15, 2026)

This is **style transfer** in action. Instead of trying to describe the exact voice we want, we show Claude examples. Much more effective.

---

## What Made This Project Successful

1. **Clear separation of concerns:** Grok fetches, Claude analyzes, the UI displays. Each component has one job.

2. **Parallel everything:** We shaved seconds off every request by not waiting unnecessarily.

3. **User experience first:** Preloading elaborations, animated loading states, progress countdowns. These details matter.

4. **Defensive programming:** AI is unpredictable. We validate, sanitize, and fallback at every step.

5. **Iteration:** We shipped v1, gathered feedback, and improved. The "Tell me more" feature came from watching users want to dig deeper.

---

## How to Run This Locally

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Run development server
npm run dev
```

---

## Final Thoughts

This project taught me that the best software often feels like magic to users while being straightforward under the hood. The magic isn't in complex algorithms—it's in thoughtful integration of multiple services, careful attention to UX, and relentless focus on the user's actual needs.

The market doesn't need another price tracker. It needs something that answers "what's happening and why?" That's what we built.

---

*Built with curiosity, caffeine, and Claude.*

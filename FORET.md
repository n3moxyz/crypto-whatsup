# FOR[ET].md - Crypto Report Generator

*A behind-the-scenes look at building a market intelligence app that actually thinks*

---

## The Big Picture: What Is This Thing?

Imagine having a financial analyst friend who never sleeps, constantly scrolls Crypto Twitter, tracks every price movement, and can explain what's happening in plain English whenever you ask. That's what we built here.

**Crypto - What's Up?** is a market intelligence app that:
1. Fetches real-time cryptocurrency prices
2. Scans the last 48 hours of Crypto Twitter via Grok (X's AI)
3. Synthesizes everything through Claude to generate actionable insights
4. Delivers reports via web interface AND Telegram bot

It's not just a price tracker. It's a *reasoning engine* that connects the dots between market movements and the narratives driving them.

---

## The Architecture: A Tale of Three AIs

Here's where it gets interesting. This project uses **three different AI systems**, each doing what it does best:

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│    CoinGecko     │     │       Grok       │     │      Claude      │
│   (Price Data)   │     │ (Twitter Intel)  │     │   (Analysis)     │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                        │
         │   Raw prices           │   Market narratives    │   Synthesis
         └────────────────────────┼────────────────────────┘
                                  │
                         ┌────────▼────────┐
                         │   Next.js API   │
                         │    Routes       │
                         └────────┬────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
              ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
              │    Web    │ │  Telegram │ │   Cache   │
              │    UI     │ │    Bot    │ │  (24hr)   │
              └───────────┘ └───────────┘ └───────────┘
```

### Why Three AIs?

**CoinGecko** isn't AI—it's a data API. But it's the foundation. You can't analyze the market without knowing where prices actually are.

**Grok** has a superpower: it can search X/Twitter in real-time. No other AI can do this. When Bitcoin dumps 5%, Grok knows whether it's because of a Fed announcement, a whale wallet moving coins, or just weekend liquidity. It's our "ears on the ground."

**Claude** is the brain. It takes cold numbers from CoinGecko and hot takes from Grok, then produces measured analysis. Claude's job is to be *skeptical*—to separate signal from noise and explain the "why" behind price movements.

---

## The Codebase: How Everything Connects

### Directory Structure (The Map)

```
crypto-report-generator/
├── app/
│   ├── api/                          # All the backend magic
│   │   ├── whatsup/route.ts          # Main market summary endpoint
│   │   ├── whatsup/followup/route.ts # Interactive Q&A
│   │   ├── prices/route.ts           # CoinGecko integration
│   │   ├── telegram/route.ts         # Telegram webhook
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
│   ├── grok.ts                       # Grok integration
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

### Grammy (Telegram Bot Framework)

**Why?** Grammy is the modern successor to Telegraf. Better TypeScript support, more intuitive API.

**Architecture decision:** We use webhooks, not polling. This means:
- Instant responses (no polling delay)
- Vercel-compatible (stateless)
- Must return within 30 seconds (or Telegram retries)

**The clever solution:** Fire-and-forget pattern. The webhook immediately returns 200 OK, then processes the message asynchronously.

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

### Bug #4: The Telegram Timeout

**The problem:** Users clicking `/whatsup` in Telegram would sometimes get no response. The bot seemed dead.

**The investigation:** Telegram webhooks must respond within 30 seconds. Our AI calls were taking 45-60 seconds.

**The fix:** Fire-and-forget architecture:
```typescript
// Immediately respond to Telegram
res.status(200).send('OK');

// Process asynchronously (user sees "loading..." then edited message)
processWhatsUp(chatId).then(result => {
  bot.api.editMessageText(chatId, loadingMsgId, result);
});
```

**The lesson:** Never block on long-running operations in webhooks. Acknowledge immediately, process later.

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
TELEGRAM_BOT_TOKEN=...
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

## The Telegram Bot: A Mini-Project Within

The Telegram integration deserves special attention. It's practically its own app.

### Command Structure

```
/start   → Welcome message with instructions
/whatsup → Full market summary (same as web)
/prices  → Quick price check with refresh buttons
/report  → Password-protected weekly update
```

### The Webhook Architecture

```
Telegram → POST /api/telegram → Grammy parses → Command router
                                                    ↓
                                           Fire-and-forget
                                           processing
                                                    ↓
                                           Edit original
                                           "Loading..." message
```

### Inline Keyboards

We use inline buttons extensively:
```typescript
const keyboard = new InlineKeyboard()
  .text('🔄 Refresh', 'refresh_prices')
  .text('📊 Full Report', 'whatsup');
```

Users can interact without typing. Better UX.

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

# For Telegram (optional)
npm run setup-webhook  # After deploying
```

---

## Final Thoughts

This project taught me that the best software often feels like magic to users while being straightforward under the hood. The magic isn't in complex algorithms—it's in thoughtful integration of multiple services, careful attention to UX, and relentless focus on the user's actual needs.

The market doesn't need another price tracker. It needs something that answers "what's happening and why?" That's what we built.

---

*Built with curiosity, caffeine, and Claude.*

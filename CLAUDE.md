# CLAUDE.md

> **Self-Updating Rule**: This file is a living document. Claude should proactively update it when:
> - New patterns, conventions, or architectural decisions are established
> - New key files or directories are added
> - Commands or workflows change
> - Bugs/gotchas are discovered worth remembering
> - Environment variables are added/removed

> **FORET.md Maintenance**: After completing significant changes to this project, Claude MUST update `FORET.md` to reflect:
> - New features or architectural changes (add to relevant sections)
> - Bugs encountered and how they were fixed (add to "Bugs We Fought" section)
> - New patterns or best practices discovered (add to "Patterns" or "Best Practices" sections)
> - Technology changes or additions (update tech stack discussion)
> - Lessons learned (add to "Things I Wish I'd Known" or create new subsection)
>
> Keep the engaging, conversational tone. Use analogies where helpful. This is a learning document, not dry documentation.

## Project Overview
Crypto market intelligence app combining real-time prices, AI analysis, and Telegram bot delivery.

## Tech Stack
- **Framework**: Next.js 16 + React 19 + TypeScript
- **Styling**: Tailwind CSS 4
- **AI**: Claude API (reports), OpenAI/Grok (market summaries)
- **Data**: CoinGecko API (prices)
- **Bot**: Grammy (Telegram)
- **Deploy**: Vercel

## Key Files
- `app/page.tsx` - Main UI
- `app/api/` - API routes (generate, prices, whatsup, whatsup/followup, telegram, cron)
- `lib/claude.ts` - Report generation
- `lib/openai.ts` - Market summary generation
- `lib/coingecko.ts` - Price fetching
- `lib/grok.ts` - X/Twitter intelligence
- `lib/telegram/` - Bot commands and handlers
- `components/WhatsUpDisplay.tsx` - Market overview with interactive follow-up chat

## First Run Setup

```bash
# 1. Install dependencies
npm install

# 2. Create environment file
cp .env.local.example .env.local

# 3. Fill in your API keys in .env.local:
#    - ANTHROPIC_API_KEY (Claude)
#    - OPENAI_API_KEY
#    - XAI_API_KEY (Grok)
#    - TELEGRAM_BOT_TOKEN

# 4. Start dev server
npm run dev
```

## Commands
```bash
npm run dev      # Start dev server (http://localhost:3100)
npm run build    # Production build
npm run lint     # Run ESLint
```

## Dev Server Management

> **CRITICAL**: NEVER run `taskkill /F /IM node.exe` during an active Claude Code session.
> Claude Code runs on Node.js — killing all node processes kills Claude Code itself, crashing the session.

**Restart dev server (safe mid-session):**
```powershell
# Kill only the process on port 3100, leave Claude Code alive
powershell -Command "Get-NetTCPConnection -LocalPort 3100 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
```

**End-of-session cleanup (user runs manually after exiting Claude Code):**
```powershell
taskkill /F /IM node.exe
```

## Architecture
1. User requests via web UI or Telegram bot
2. Prices fetched from CoinGecko
3. Market intelligence from Grok (X/Twitter)
4. Claude/OpenAI generates analysis
5. Results cached and displayed

## Style Guide
- Functional components with TypeScript
- Tailwind for styling (dark mode support via class strategy)
- API routes in `app/api/[route]/route.ts`
- Shared logic in `lib/`
- Components in `components/`

## Features

### Interactive Follow-up (What's Up Section)
- **Pre-loaded elaborations**: When market data loads, AI elaborations for each bullet point are fetched in parallel and cached
- **"Tell me more" buttons**: Each bullet point has an expand/collapse button to show pre-loaded AI elaboration
- **Chat interface**: Freeform follow-up questions with conversation history support
- **Sentiment derivation**: Sentiment pill (bullish/bearish/neutral) is derived from conclusion text for accuracy, not just API response
- **Animated loading**: Countdown timer with rotating status messages during data fetch
- **Text formatting**: Crypto prices are highlighted in purple when preceded by ticker symbols (e.g., "BTC $89k")

## Environment Variables
Required in `.env.local`:
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `XAI_API_KEY` (Grok)

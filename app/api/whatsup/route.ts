import { NextRequest, NextResponse } from "next/server";
import { generateWhatsUp } from "@/lib/market-summary";
import { getCachedWhatsUp, setCachedWhatsUp, getCacheAge } from "@/lib/cache";
import { checkRateLimit } from "@/lib/rateLimit";
import { checkDailyBudget, incrementDailyBudget } from "@/lib/dailyBudget";

// Cooldown for force-refresh: 10 minutes per IP
const REFRESH_COOLDOWN_MS = 10 * 60 * 1000;
const refreshCooldowns = new Map<string, number>();

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() ||
    "unknown"
  );
}

export async function GET(request: NextRequest) {
  // Check rate limit
  const rateLimitResult = checkRateLimit(request);

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
          ),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(rateLimitResult.resetTime),
        },
      }
    );
  }

  try {
    const url = new URL(request.url);
    const refreshRequested = url.searchParams.get("refresh") === "true";
    const clientIP = getClientIP(request);

    // Force-refresh is rate-limited: once per 10 minutes per IP
    // Admin bypass token skips the cooldown
    const adminBypassToken = process.env.ADMIN_BYPASS_TOKEN;
    const token = url.searchParams.get("token");
    const isAdmin = !!(adminBypassToken && token === adminBypassToken);

    let forceRefresh = false;
    if (refreshRequested && !isAdmin) {
      const lastRefresh = refreshCooldowns.get(clientIP) || 0;
      if (Date.now() - lastRefresh >= REFRESH_COOLDOWN_MS) {
        forceRefresh = true;
        refreshCooldowns.set(clientIP, Date.now());
      }
      // If cooldown hasn't elapsed, fall through to serve cache
    } else if (refreshRequested && isAdmin) {
      forceRefresh = true;
    }

    // Check for cached data first (unless force refresh is allowed)
    if (!forceRefresh) {
      const cached = await getCachedWhatsUp();

      if (cached) {
        return NextResponse.json({
          ...cached.data,
          timestamp: cached.timestamp,
          cached: true,
          cacheAge: getCacheAge(cached),
        });
      }
    }

    // No valid cache or force refresh — generate fresh data
    const budgetResult = checkDailyBudget();
    if (!budgetResult.allowed) {
      return NextResponse.json(
        { error: "Daily API budget exceeded. Please try again tomorrow." },
        { status: 429 }
      );
    }

    const data = await generateWhatsUp();
    incrementDailyBudget();

    // Cache the result
    await setCachedWhatsUp(data);

    return NextResponse.json({
      ...data,
      timestamp: new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    console.error("Error generating WhatsUp:", error);
    return NextResponse.json(
      { error: "Failed to generate market summary" },
      { status: 500 }
    );
  }
}

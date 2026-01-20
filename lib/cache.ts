import { WhatsUpData } from "./openai";
import { promises as fs } from "fs";
import path from "path";

interface CachedWhatsUp {
  data: WhatsUpData;
  timestamp: string;
  expiresAt: string;
}

// Cache duration: 24 hours in milliseconds (Vercel Hobby plan only allows daily cron)
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

// In-memory cache (survives warm function instances)
let memoryCache: CachedWhatsUp | null = null;

// File cache path (works on Vercel /tmp and locally)
function getCachePath(): string {
  // Use /tmp on Vercel, local .cache directory otherwise
  const cacheDir = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), ".cache");
  return path.join(cacheDir, "whatsup-cache.json");
}

async function ensureCacheDir(): Promise<void> {
  const cachePath = getCachePath();
  const dir = path.dirname(cachePath);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // Directory might already exist
  }
}

export async function getCachedWhatsUp(): Promise<CachedWhatsUp | null> {
  // Check memory cache first
  if (memoryCache) {
    const now = new Date();
    const expiresAt = new Date(memoryCache.expiresAt);
    if (now < expiresAt) {
      return memoryCache;
    }
  }

  // Try file cache
  try {
    const cachePath = getCachePath();
    const content = await fs.readFile(cachePath, "utf-8");
    const cached: CachedWhatsUp = JSON.parse(content);

    const now = new Date();
    const expiresAt = new Date(cached.expiresAt);

    if (now < expiresAt) {
      // Update memory cache
      memoryCache = cached;
      return cached;
    }
  } catch {
    // Cache file doesn't exist or is invalid
  }

  return null;
}

export async function setCachedWhatsUp(data: WhatsUpData): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_DURATION_MS);

  const cached: CachedWhatsUp = {
    data,
    timestamp: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  // Update memory cache
  memoryCache = cached;

  // Write to file cache
  try {
    await ensureCacheDir();
    const cachePath = getCachePath();
    await fs.writeFile(cachePath, JSON.stringify(cached, null, 2));
  } catch (error) {
    console.error("Failed to write cache file:", error);
  }
}

export function getCacheAge(cached: CachedWhatsUp): string {
  const now = new Date();
  const timestamp = new Date(cached.timestamp);
  const ageMs = now.getTime() - timestamp.getTime();

  const minutes = Math.floor(ageMs / (1000 * 60));
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m ago`;
}

export async function clearCache(): Promise<void> {
  memoryCache = null;
  try {
    const cachePath = getCachePath();
    await fs.unlink(cachePath);
  } catch {
    // File might not exist
  }
}

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

const CACHE_FILE = process.env.CACHE_FILE || path.join(process.cwd(), 'cache.json');
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || 60 * 60 * 24 * 7);
const MAX_CACHE_ENTRIES = Number(process.env.CACHE_MAX_ENTRIES || 1000);

// Interface definitions for the cache structure.
interface CacheEntry {
  value: string;
  updatedAt: number;
}

interface CacheData {
  [hash: string]: CacheEntry;
}

// Loads the cache data from the filesystem.
// Returns an empty object if the file does not exist or if an error occurs during reading.
async function loadCache(): Promise<CacheData> {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    const parsed: CacheData = JSON.parse(data);
    return pruneCache(parsed);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      console.error('Error loading cache:', error);
    }
    return {};
  }
}

// Persists the cache data to the filesystem.
async function saveCache(cache: CacheData): Promise<void> {
  try {
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving cache:', error);
  }
}

function pruneCache(cache: CacheData): CacheData {
  const now = Date.now();
  const ttlMs = Math.max(0, CACHE_TTL_SECONDS) * 1000;

  const entries = Object.entries(cache).filter(([, entry]) => {
    if (!entry || typeof entry.updatedAt !== 'number') return false;
    if (ttlMs === 0) return true;
    return now - entry.updatedAt <= ttlMs;
  });

  if (entries.length <= MAX_CACHE_ENTRIES) {
    return Object.fromEntries(entries);
  }

  const sorted = entries.sort((a, b) => a[1].updatedAt - b[1].updatedAt);
  const trimmed = sorted.slice(sorted.length - MAX_CACHE_ENTRIES);
  return Object.fromEntries(trimmed);
}

// Generates a SHA256 hash of the input string to serve as a cache key.
export function hashContext(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// Retrieves a cached category for the given text, if available.
export async function getCachedCategory(text: string): Promise<string | null> {
  const hash = hashContext(text);
  const cache = await loadCache();
  const entry = cache[hash];
  return entry ? entry.value : null;
}

// Stores a new category mapping in the cache.
export async function setCachedCategory(text: string, category: string): Promise<void> {
  const hash = hashContext(text);
  const cache = await loadCache();
  cache[hash] = { value: category, updatedAt: Date.now() };
  await saveCache(cache);
}

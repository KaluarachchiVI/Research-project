import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const CACHE_FILE = path.join(__dirname, '../../cache.json');

// Interface definitions for the cache structure.
interface CacheData {
  [hash: string]: string;
}

// Loads the cache data from the filesystem.
// Returns an empty object if the file does not exist or if an error occurs during reading.
function loadCache(): CacheData {
  if (!fs.existsSync(CACHE_FILE)) {
    return {};
  }
  try {
    const data = fs.readFileSync(CACHE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error("Error loading cache:", error);
    return {};
  }
}

// Persists the cache data to the filesystem.
function saveCache(cache: CacheData) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (error) {
    console.error("Error saving cache:", error);
  }
}

// Generates a SHA256 hash of the input string to serve as a cache key.
export function hashContext(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// Retrieves a cached category for the given text, if available.
export function getCachedCategory(text: string): string | null {
  const hash = hashContext(text);
  const cache = loadCache();
  return cache[hash] || null;
}

// Stores a new category mapping in the cache.
export function setCachedCategory(text: string, category: string): void {
  const hash = hashContext(text);
  const cache = loadCache();
  cache[hash] = category;
  saveCache(cache);
}

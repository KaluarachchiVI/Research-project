import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const CACHE_FILE = path.join(__dirname, '../../cache.json');

// Interface for cache structure
interface CacheData {
  [hash: string]: string;
}

// Load cache from file
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

// Save cache to file
function saveCache(cache: CacheData) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (error) {
    console.error("Error saving cache:", error);
  }
}

// Generate SHA256 hash of a string
export function hashContext(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// Get cached category if exists
export function getCachedCategory(text: string): string | null {
  const hash = hashContext(text);
  const cache = loadCache();
  return cache[hash] || null;
}

// Cache a new category
export function setCachedCategory(text: string, category: string): void {
  const hash = hashContext(text);
  const cache = loadCache();
  cache[hash] = category;
  saveCache(cache);
}

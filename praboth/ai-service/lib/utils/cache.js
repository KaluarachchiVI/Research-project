"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashContext = hashContext;
exports.getCachedCategory = getCachedCategory;
exports.setCachedCategory = setCachedCategory;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const CACHE_FILE = process.env.CACHE_FILE || path.join(process.cwd(), 'cache.json');
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || 60 * 60 * 24 * 7);
const MAX_CACHE_ENTRIES = Number(process.env.CACHE_MAX_ENTRIES || 1000);
// Loads the cache data from the filesystem.
// Returns an empty object if the file does not exist or if an error occurs during reading.
async function loadCache() {
    try {
        const data = await fs.readFile(CACHE_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        return pruneCache(parsed);
    }
    catch (error) {
        if ((error === null || error === void 0 ? void 0 : error.code) !== 'ENOENT') {
            console.error('Error loading cache:', error);
        }
        return {};
    }
}
// Persists the cache data to the filesystem.
async function saveCache(cache) {
    try {
        await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
    }
    catch (error) {
        console.error('Error saving cache:', error);
    }
}
function pruneCache(cache) {
    const now = Date.now();
    const ttlMs = Math.max(0, CACHE_TTL_SECONDS) * 1000;
    const entries = Object.entries(cache).filter(([, entry]) => {
        if (!entry || typeof entry.updatedAt !== 'number')
            return false;
        if (ttlMs === 0)
            return true;
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
function hashContext(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
}
// Retrieves a cached category for the given text, if available.
async function getCachedCategory(text) {
    const hash = hashContext(text);
    const cache = await loadCache();
    const entry = cache[hash];
    return entry ? entry.value : null;
}
// Stores a new category mapping in the cache.
async function setCachedCategory(text, category) {
    const hash = hashContext(text);
    const cache = await loadCache();
    cache[hash] = { value: category, updatedAt: Date.now() };
    await saveCache(cache);
}
//# sourceMappingURL=cache.js.map
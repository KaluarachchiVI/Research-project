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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const CACHE_FILE = path.join(__dirname, '../../cache.json');
// Load cache from file
function loadCache() {
    if (!fs.existsSync(CACHE_FILE)) {
        return {};
    }
    try {
        const data = fs.readFileSync(CACHE_FILE, 'utf-8');
        return JSON.parse(data);
    }
    catch (error) {
        console.error("Error loading cache:", error);
        return {};
    }
}
// Save cache to file
function saveCache(cache) {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
    }
    catch (error) {
        console.error("Error saving cache:", error);
    }
}
// Generate SHA256 hash of a string
function hashContext(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
}
// Get cached category if exists
function getCachedCategory(text) {
    const hash = hashContext(text);
    const cache = loadCache();
    return cache[hash] || null;
}
// Cache a new category
function setCachedCategory(text, category) {
    const hash = hashContext(text);
    const cache = loadCache();
    cache[hash] = category;
    saveCache(cache);
}
//# sourceMappingURL=cache.js.map
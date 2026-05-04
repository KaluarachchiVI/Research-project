const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, beforeEach, afterEach } = require('node:test');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-cache-test-'));
let cacheFile = path.join(tempDir, 'cache.json');

function loadCacheModule() {
  delete require.cache[require.resolve('../lib/utils/cache.js')];
  return require('../lib/utils/cache.js');
}

beforeEach(() => {
  cacheFile = path.join(tempDir, `cache-${Date.now()}.json`);
  process.env.CACHE_FILE = cacheFile;
});

afterEach(() => {
  if (fs.existsSync(cacheFile)) {
    fs.unlinkSync(cacheFile);
  }
});

test('cache round-trip stores and retrieves', async () => {
  process.env.CACHE_TTL_SECONDS = '3600';
  process.env.CACHE_MAX_ENTRIES = '100';
  const { getCachedCategory, setCachedCategory } = loadCacheModule();

  await setCachedCategory('hello', 'Greeting');
  const value = await getCachedCategory('hello');

  assert.equal(value, 'Greeting');
});

test('cache honors TTL and evicts expired entries', async () => {
  process.env.CACHE_TTL_SECONDS = '0.001';
  process.env.CACHE_MAX_ENTRIES = '100';
  const { getCachedCategory, setCachedCategory } = loadCacheModule();

  await setCachedCategory('short-lived', 'Temp');
  await new Promise((resolve) => setTimeout(resolve, 10));
  const value = await getCachedCategory('short-lived');

  assert.equal(value, null);
});

test('cache evicts oldest when over max entries', async () => {
  process.env.CACHE_TTL_SECONDS = '3600';
  process.env.CACHE_MAX_ENTRIES = '2';
  const { getCachedCategory, setCachedCategory } = loadCacheModule();

  await setCachedCategory('a', 'A');
  await new Promise((resolve) => setTimeout(resolve, 2));
  await setCachedCategory('b', 'B');
  await new Promise((resolve) => setTimeout(resolve, 2));
  await setCachedCategory('c', 'C');

  const valueA = await getCachedCategory('a');
  const valueB = await getCachedCategory('b');
  const valueC = await getCachedCategory('c');

  assert.equal(valueA, null);
  assert.equal(valueB, 'B');
  assert.equal(valueC, 'C');
});

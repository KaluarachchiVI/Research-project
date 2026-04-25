const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, beforeEach, afterEach } = require('node:test');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-flow-test-'));
let cacheFile = path.join(tempDir, 'cache.json');

function loadFlowModule() {
  delete require.cache[require.resolve('../lib/flows/categorization.js')];
  return require('../lib/flows/categorization.js');
}

function loadCacheModule() {
  delete require.cache[require.resolve('../lib/utils/cache.js')];
  return require('../lib/utils/cache.js');
}

beforeEach(() => {
  cacheFile = path.join(tempDir, `cache-${Date.now()}.json`);
  process.env.CACHE_FILE = cacheFile;
  process.env.CACHE_TTL_SECONDS = '3600';
  process.env.CACHE_MAX_ENTRIES = '100';
  process.env.GENKIT_MOCK_CATEGORY = 'Mocked';
});

afterEach(() => {
  if (fs.existsSync(cacheFile)) {
    fs.unlinkSync(cacheFile);
  }
  delete process.env.GENKIT_MOCK_CATEGORY;
});

test('categorizeContext returns mocked category on cache miss', async () => {
  const { categorizeContext } = loadFlowModule();
  const result = await categorizeContext({ text: 'Writing code' });

  assert.equal(result.category, 'Mocked');
  assert.equal(result.isCached, false);
});

test('categorizeContext returns cached category on hit', async () => {
  const { setCachedCategory } = loadCacheModule();
  await setCachedCategory('Cached input', 'CachedValue');

  const { categorizeContext } = loadFlowModule();
  const result = await categorizeContext({ text: 'Cached input' });

  assert.equal(result.category, 'CachedValue');
  assert.equal(result.isCached, true);
});

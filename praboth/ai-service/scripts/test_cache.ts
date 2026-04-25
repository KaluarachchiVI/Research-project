import { getCachedCategory, setCachedCategory } from '../src/utils/cache';

async function run() {
  const seed = `test-${Date.now()}`;
  await setCachedCategory(seed, 'Testing');
  const cached = await getCachedCategory(seed);
  if (cached !== 'Testing') {
    throw new Error(`Cache read failed: ${cached}`);
  }
  console.log('Cache read/write: ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

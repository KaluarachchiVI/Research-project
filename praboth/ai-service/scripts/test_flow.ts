import { categorizeContext } from '../src/index';

// Executes a series of tests to verify the functionality of the context categorization flow.
// This script simulates different caching scenarios (cold cache, cache hit) and new context processing.
async function runTest() {
  console.log("--- Test 1: First Run (Cold Cache) ---");
  console.log("Input: 'I am writing code for my react project'");
  try {
    const result1 = await categorizeContext({ text: 'I am writing code for my react project' });
    console.log("Result 1:", result1);
  } catch (e) {
    console.error("Error in Test 1:", e);
  }

  console.log("\n--- Test 2: Second Run (Expected Cache Hit) ---");
  console.log("Input: 'I am writing code for my react project'");
  try {
    const result2 = await categorizeContext({ text: 'I am writing code for my react project' });
    console.log("Result 2:", result2);
  } catch (e) {
    console.error("Error in Test 2:", e);
  }
  
    console.log("\n--- Test 3: New Context ---");
  console.log("Input: 'Playing Valorant with friends'");
  try {
    const result3 = await categorizeContext({ text: 'Playing Valorant with friends' });
    console.log("Result 3:", result3);
  } catch (e) {
    console.error("Error in Test 3:", e);
  }
}

runTest();

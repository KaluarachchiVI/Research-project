import { genkit, z } from 'genkit';
import { defineFlow } from '@genkit-ai/flow';
import { googleAI } from '@genkit-ai/googleai';
import { getCachedCategory, setCachedCategory } from '../utils/cache';

// Initializes the Genkit instance using the Google AI plugin.
// While Genkit typically handles configuration at the entry point, a local instance is initialized here 
// to independently support the categorization flow.
const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash', 
});

// Defines the input schema for the context categorization request.
const ContextInputSchema = z.object({
  text: z.string(),
});

// Defines the output schema returning the determined category and its cache status.
const CategoryOutputSchema = z.object({
  category: z.string(),
  isCached: z.boolean(),
});

// Defines the main categorization flow.
// This flow checks the local cache first; if a hit occurs, it returns the cached category.
// Otherwise, it queries the generative model to classify the context and caches the result.
export const categorizeContext = defineFlow(
  {
    name: 'categorizeContext',
    inputSchema: ContextInputSchema,
    outputSchema: CategoryOutputSchema,
  },
  categorizeContextImpl
);

export async function categorizeContextImpl(input: { text: string }) {
  const { text } = input;

  // 1. Checks the local cache for an existing categorization.
  const cachedCategory = await getCachedCategory(text);
  if (cachedCategory) {
    console.log('Cache Hit!');
    return {
      category: cachedCategory,
      isCached: true,
    };
  }

  // 2. Cache miss: Invokes the Gemini model to generate a new category.
  console.log('Cache Miss. Calling Gemini...');

  const mockCategory = process.env.GENKIT_MOCK_CATEGORY;
  const category = mockCategory
    ? mockCategory
    : (
        await ai.generate({
          prompt: `Analyze the following user context and categorize it into a single, concise category (e.g., "Studying", "Gaming", "Working", "Relaxing", "Meeting"). Return ONLY the category name.

          Context: "${text}"`,
        })
      ).text;

  if (!category) {
    throw new Error("Failed to generate category");
  }

  const cleanCategory = category.trim();

  // 3. Updates the cache with the newly generated category.
  await setCachedCategory(text, cleanCategory);

  return {
    category: cleanCategory,
    isCached: false,
  };
}

import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { getCachedCategory, setCachedCategory } from '../utils/cache';

// Initialize Genkit with Google AI plugin (singleton-like behavior handled by genkit)
// Note: In Genkit, configureGenkit is usually called once at entry, but defineFlow needs 'ai' instance or similar.
// Actually, with the new SDK, 'ai' instance is created by 'genkit({...})'.
// We should probably export 'ai' from a central config or just initialize here if it's the only place.
// Better practice: centralized 'ai' instance.

// Let's create a shared ai instance file or just keep it simple for now. 
// Ideally "src/config/genkit.ts" or just reuse here. 
// I'll assume we want to isolate the flow. 

const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash', 
});

// Define the Input Schema
const ContextInputSchema = z.object({
  text: z.string(),
});

// Define the Output Schema
const CategoryOutputSchema = z.object({
  category: z.string(),
  isCached: z.boolean(),
});

// Define the Flow
export const categorizeContext = ai.defineFlow(
  {
    name: 'categorizeContext',
    inputSchema: ContextInputSchema,
    outputSchema: CategoryOutputSchema,
  },
  async (input) => {
    const { text } = input;

    // 1. Check Cache
    const cachedCategory = getCachedCategory(text);
    if (cachedCategory) {
      console.log('Cache Hit!');
      return {
        category: cachedCategory,
        isCached: true,
      };
    }

    // 2. Not in Cache -> Call LLM
    console.log('Cache Miss. Calling Gemini...');
    
    // Note: ai.generate is available on the instance
    const { text: category } = await ai.generate({
      prompt: `Analyze the following user context and categorize it into a single, concise category (e.g., "Studying", "Gaming", "Working", "Relaxing", "Meeting"). Return ONLY the category name.
      
      Context: "${text}"`,
    });

    if (!category) {
        throw new Error("Failed to generate category");
    }

    const cleanCategory = category.trim();

    // 3. Update Cache
    setCachedCategory(text, cleanCategory);

    return {
      category: cleanCategory,
      isCached: false,
    };
  }
);

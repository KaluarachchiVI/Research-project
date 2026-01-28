import * as dotenv from 'dotenv';
dotenv.config();
import { genkit, z } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/googleai';
import { getCachedCategory, setCachedCategory } from './cache';

// Initialize Genkit with Google AI plugin
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



"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categorizeContext = void 0;
const genkit_1 = require("genkit");
const googleai_1 = require("@genkit-ai/googleai");
const cache_1 = require("../utils/cache");
// Initializes the Genkit instance using the Google AI plugin.
// While Genkit typically handles configuration at the entry point, a local instance is initialized here 
// to independently support the categorization flow.
const ai = (0, genkit_1.genkit)({
    plugins: [(0, googleai_1.googleAI)()],
    model: 'googleai/gemini-2.0-flash',
});
// Defines the input schema for the context categorization request.
const ContextInputSchema = genkit_1.z.object({
    text: genkit_1.z.string(),
});
// Defines the output schema returning the determined category and its cache status.
const CategoryOutputSchema = genkit_1.z.object({
    category: genkit_1.z.string(),
    isCached: genkit_1.z.boolean(),
});
// Defines the main categorization flow.
// This flow checks the local cache first; if a hit occurs, it returns the cached category.
// Otherwise, it queries the generative model to classify the context and caches the result.
exports.categorizeContext = ai.defineFlow({
    name: 'categorizeContext',
    inputSchema: ContextInputSchema,
    outputSchema: CategoryOutputSchema,
}, async (input) => {
    const { text } = input;
    // 1. Checks the local cache for an existing categorization.
    const cachedCategory = (0, cache_1.getCachedCategory)(text);
    if (cachedCategory) {
        console.log('Cache Hit!');
        return {
            category: cachedCategory,
            isCached: true,
        };
    }
    // 2. Cache miss: Invokes the Gemini model to generate a new category.
    console.log('Cache Miss. Calling Gemini...');
    // Generates the category using the configured prompt.
    const { text: category } = await ai.generate({
        prompt: `Analyze the following user context and categorize it into a single, concise category (e.g., "Studying", "Gaming", "Working", "Relaxing", "Meeting"). Return ONLY the category name.
      
      Context: "${text}"`,
    });
    if (!category) {
        throw new Error("Failed to generate category");
    }
    const cleanCategory = category.trim();
    // 3. Updates the cache with the newly generated category.
    (0, cache_1.setCachedCategory)(text, cleanCategory);
    return {
        category: cleanCategory,
        isCached: false,
    };
});
//# sourceMappingURL=categorization.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categorizeContext = void 0;
const genkit_1 = require("genkit");
const googleai_1 = require("@genkit-ai/googleai");
const cache_1 = require("../utils/cache");
// Initialize Genkit with Google AI plugin (singleton-like behavior handled by genkit)
// Note: In Genkit, configureGenkit is usually called once at entry, but defineFlow needs 'ai' instance or similar.
// Actually, with the new SDK, 'ai' instance is created by 'genkit({...})'.
// We should probably export 'ai' from a central config or just initialize here if it's the only place.
// Better practice: centralized 'ai' instance.
// Let's create a shared ai instance file or just keep it simple for now. 
// Ideally "src/config/genkit.ts" or just reuse here. 
// I'll assume we want to isolate the flow. 
const ai = (0, genkit_1.genkit)({
    plugins: [(0, googleai_1.googleAI)()],
    model: 'googleai/gemini-2.0-flash',
});
// Define the Input Schema
const ContextInputSchema = genkit_1.z.object({
    text: genkit_1.z.string(),
});
// Define the Output Schema
const CategoryOutputSchema = genkit_1.z.object({
    category: genkit_1.z.string(),
    isCached: genkit_1.z.boolean(),
});
// Define the Flow
exports.categorizeContext = ai.defineFlow({
    name: 'categorizeContext',
    inputSchema: ContextInputSchema,
    outputSchema: CategoryOutputSchema,
}, async (input) => {
    const { text } = input;
    // 1. Check Cache
    const cachedCategory = (0, cache_1.getCachedCategory)(text);
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
    (0, cache_1.setCachedCategory)(text, cleanCategory);
    return {
        category: cleanCategory,
        isCached: false,
    };
});
//# sourceMappingURL=categorization.js.map
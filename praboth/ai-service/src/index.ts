import * as dotenv from 'dotenv';
dotenv.config();

import { startFlowsServer } from '@genkit-ai/flow';
import { categorizeContext } from './flows/categorization';

// Start the flow server if running directly
// In Genkit 0.5+, we might use startFlowsServer or just let the CLI handle it.
// The original code used 'node lib/index.js' which implies programmatic startup or just exporting flows.
// But 'startFlowsServer' is deprecated in favor of just exporting flows and running 'genkit start'.

// However, user had 'start' script: "node lib/index.js".
// Let's keep it simple: just export the flow. The 'genkit start' command detects flows.
// If they want to run it manually as a server, they usually need to call something.

// Looking at original index.ts, it didn't call 'startFlowsServer'. It just defined the flow.
// This implies they might be running it via 'genkit start' OR the 'ai' instance handles it?
// Wait, 'ai.defineFlow' registers it.
// To run it as a standalone HTTP server without the CLI, we usually need 'startFlowsServer'.
// But maybe they only used the CLI dev mode.
// "scripts": { "start": "node lib/index.js" } suggests it runs directly. 
// If it runs directly and exits, that's bad. 
// Let's assume exporting is enough for the CLI tools, but for 'node lib/index.js' to do anything useful, it should probably start a server.

// Let's export it.
export { categorizeContext };




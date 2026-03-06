import * as dotenv from 'dotenv';
dotenv.config();

import { startFlowsServer } from '@genkit-ai/flow';
import { categorizeContext } from './flows/categorization';

// Starts the flow server if the module is executed directly.
// In newer Genkit versions, the CLI typically manages the server, but explicit export is maintained
// for compatibility with potential programmatic entry points or custom server setups.

// Exports the categorization flow for consumption by the Genkit CLI or other modules.
export { categorizeContext };




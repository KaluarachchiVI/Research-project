import * as dotenv from 'dotenv';
dotenv.config();

import { startFlowsServer } from '@genkit-ai/flow';
import { categorizeContext } from './flows/categorization';

// Starts the flow server if the module is executed directly.
// In newer Genkit versions, the CLI typically manages the server, but explicit start is maintained
// for compatibility with programmatic entry points or custom server setups.
if (require.main === module) {
	const port = Number(process.env.PORT || 3400);
	startFlowsServer({ flows: [categorizeContext], port });
}

// Exports the categorization flow for consumption by the Genkit CLI or other modules.
export { categorizeContext };




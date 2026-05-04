"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.categorizeContext = void 0;
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const flow_1 = require("@genkit-ai/flow");
const categorization_1 = require("./flows/categorization");
Object.defineProperty(exports, "categorizeContext", { enumerable: true, get: function () { return categorization_1.categorizeContext; } });
// Starts the flow server if the module is executed directly.
// In newer Genkit versions, the CLI typically manages the server, but explicit start is maintained
// for compatibility with programmatic entry points or custom server setups.
if (require.main === module) {
    const port = Number(process.env.PORT || 3400);
    (0, flow_1.startFlowsServer)({ flows: [categorization_1.categorizeContext], port });
}
//# sourceMappingURL=index.js.map
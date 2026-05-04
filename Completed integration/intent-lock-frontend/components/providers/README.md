# EstimatorProvider

The `EstimatorProvider` is a React context provider that enables real-time cognitive load streaming using Server-Sent Events (SSE) from the Praboth backend API.

## Features

- **Real-time SSE Streaming**: Connects to the backend's `/stream/state` endpoint for live cognitive load updates
- **Automatic Reconnection**: Implements exponential backoff reconnection logic with configurable max attempts
- **State Management**: Manages cognitive load estimates, telemetry data, and history tracking
- **Prompt Hydration**: Automatically fetches and manages EMA (Ecological Momentary Assessment) prompts
- **Error Handling**: Comprehensive error handling with connection status tracking
- **History Tracking**: Maintains up to 300 history points (5 minutes at 1Hz) for visualization

## Installation

The provider is already integrated into the application via [`../Providers.tsx`](../Providers.tsx). No additional installation is required.

## Usage

### Using the Context Hook

```tsx
import { useEstimatorContext } from "@/components/providers/EstimatorProvider";

function MyComponent() {
  const { 
    estimate, 
    telemetry, 
    history, 
    status, 
    error, 
    isConnected 
  } = useEstimatorContext();

  return (
    <div>
      <p>Status: {status}</p>
      <p>Load: {estimate?.load}</p>
      <p>Connected: {isConnected ? "Yes" : "No"}</p>
    </div>
  );
}
```

### Using the Stream Hook

For connection event handling:

```tsx
import { useEstimatorStream } from "@/hooks/useEstimatorStream";

function MyComponent() {
  const { estimate, status, isConnected } = useEstimatorStream({
    onConnect: () => console.log("Connected to estimator"),
    onDisconnect: () => console.log("Disconnected from estimator"),
  });

  return <div>Status: {status}</div>;
}
```

## API Reference

### Context Types

```typescript
type HistoryPoint = { t: number; load: number; residual: number };
type HydratedPrompt = { prompt_id: number; reason: string } | null;

type EstimatorContextType = {
  estimate: EstimateResponse | null;      // Current cognitive load estimate
  telemetry: TelemetryResponse | null;     // Telemetry data
  history: HistoryPoint[];                 // History of load estimates
  status: string;                          // Connection status message
  error: string | null;                    // Error message if any
  hydratedPrompt: HydratedPrompt;          // Current EMA prompt
  setHydratedPrompt: (p: HydratedPrompt) => void; // Update prompt
  isConnected: boolean;                    // Connection state
};
```

### EstimateResponse

```typescript
interface EstimateResponse {
  load: number;              // Current cognitive load (0-1)
  residual: number;          // Residual load
  hop_index: number;         // Current hop index
  baseline_active: boolean;  // Whether baseline is active
  scheduler_state?: string;  // Scheduler state
  pending_prompt?: {         // Pending EMA prompt
    prompt_id: number;
    reason: string;
  };
}
```

### TelemetryResponse

```typescript
interface TelemetryResponse {
  scheduler_state?: string;
  events_processed?: number;
  uptime_seconds?: number;
  last_event_time?: string;
}
```

## Configuration

### Environment Variables

Configure the backend API URL using the `NEXT_PUBLIC_API_BASE_URL` environment variable:

```env
# .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Default: `http://localhost:8000`

### Reconnection Settings

The provider uses the following reconnection settings (configurable in [`EstimatorProvider.tsx`](./EstimatorProvider.tsx)):

- **Max Reconnect Attempts**: 5
- **Reconnect Delay**: 3000ms (3 seconds)

## Connection States

The provider tracks the following connection states:

| Status | Description |
|--------|-------------|
| `connecting...` | Initial connection attempt |
| `online (stream connected)` | Successfully connected |
| `online ({state}) | hop {n} | baseline {on/off}` | Connected with details |
| `offline - connection lost` | Connection lost, attempting reconnect |
| `offline - max reconnect attempts reached` | Failed to reconnect |
| `reconnecting... (attempt n/5)` | Reconnection in progress |

## Error Handling

The provider handles the following error scenarios:

1. **Initial Data Fetch Failure**: Logs error and continues with SSE connection
2. **SSE Connection Error**: Triggers reconnection logic
3. **Pending Prompt Fetch Failure**: Logs error but doesn't interrupt stream
4. **Max Reconnect Attempts Reached**: Sets error state and stops reconnection

## Cleanup

The provider automatically cleans up connections on unmount:

```typescript
useEffect(() => {
  // ... connection logic
  
  return () => {
    clearReconnectTimeout();
    disconnect();
  };
}, []);
```

## Backend API Endpoints

The provider interacts with the following backend endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/stream/state` | SSE | Real-time state updates |
| `/estimate` | GET | Latest cognitive load estimate |
| `/telemetry` | GET | Telemetry data |
| `/ema/pending` | GET | Pending EMA prompt |
| `/ema/response` | POST | Submit EMA response |
| `/events` | POST | Ingest an event |
| `/health` | GET | Health check |

## Example: Cognitive Load Display Component

```tsx
import { useEstimatorStream } from "@/hooks/useEstimatorStream";

export function CognitiveLoadDisplay() {
  const { estimate, history, status, isConnected } = useEstimatorStream();

  if (!estimate) {
    return <div>Loading...</div>;
  }

  const loadPercentage = Math.round(estimate.load * 100);
  const residualPercentage = Math.round(estimate.residual * 100);

  return (
    <div className="p-4 border rounded">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
        <span className="text-sm text-gray-600">{status}</span>
      </div>
      
      <div className="space-y-2">
        <div>
          <label className="text-sm font-medium">Cognitive Load</label>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all" 
              style={{ width: `${loadPercentage}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">{loadPercentage}%</span>
        </div>
        
        <div>
          <label className="text-sm font-medium">Residual</label>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-orange-500 h-2 rounded-full transition-all" 
              style={{ width: `${residualPercentage}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">{residualPercentage}%</span>
        </div>
      </div>
      
      <div className="mt-4 text-xs text-gray-500">
        History points: {history.length}
      </div>
    </div>
  );
}
```

## Troubleshooting

### Connection Issues

1. **Check Backend URL**: Ensure `NEXT_PUBLIC_API_BASE_URL` is correctly set
2. **Verify Backend Running**: Confirm the Praboth backend is running on port 8000
3. **Check CORS**: Ensure CORS is configured on the backend
4. **Network Issues**: Check browser console for network errors

### No Data Received

1. **Check Backend Logs**: Verify the backend is processing events
2. **Verify API Key**: If API key auth is enabled, ensure it's configured
3. **Check Scheduler State**: The scheduler may be in a state that doesn't produce estimates

## See Also

- [API Utilities](../../lib/api.ts) - Backend API client functions
- [useEstimatorStream Hook](../../hooks/useEstimatorStream.ts) - Stream hook with event handlers
- [Providers Component](../Providers.tsx) - Main providers wrapper

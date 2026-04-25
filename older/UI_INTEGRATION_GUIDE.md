# UI Integration Guide - Unified Session Manager

## Overview

The dashboard has been updated to integrate with the new Unified Session Manager system. This allows you to:

1. **Set Time Blocks** - Specify when you want to study (start and end times)
2. **Real-time Praboth Integration** - See cognitive load from praboth service in real-time
3. **Automatic Data Syncing** - Data syncs automatically when session ends
4. **Metrics Computation** - Metrics computed automatically after syncing
5. **Next Session Suggestions** - Get adaptive suggestions for your next study session

## How to Use

### Starting a Time Block Session

1. **Open the Dashboard**: Navigate to `http://127.0.0.1:5000/dashboard`
2. **Fill in the Form**:
   - **User ID**: Your user identifier (e.g., "demo_user")
   - **Start Time**: When you want to start studying (datetime picker)
   - **End Time**: When you want to finish studying
   - **Task Type**: Type of work (writing, coding, reading, other)
   - **Chronotype**: Your preferred time (morning, evening, neutral)
   - **Algorithm**: Bandit algorithm (LinUCB or Thompson Sampling)

3. **Click "Start Time Block Session"**

The system will:
- Create an initial schedule based on your time block
- Start praboth data collection (if praboth service is running)
- Begin real-time cognitive load monitoring
- Display the schedule with work/break intervals

### During the Session

- **Timer**: Shows countdown for current interval (work or break)
- **Cognitive Load**: Displays real-time cognitive load from praboth (updates every 15 seconds)
- **Recommendations**: Get real-time recommendations based on current cognitive load
- **Pause/Resume**: Pause the session if needed
- **End Interval**: Manually end work or break intervals

### Ending a Session

1. Click **"End Session"** button
2. The system will:
   - Automatically sync praboth data to adaptive scheduler database
   - Compute metrics from the session data
   - Generate a suggestion for your next session

### Next Session Suggestion

After ending a session, if metrics are available:
- A suggestion panel will appear with a recommended schedule
- The suggestion is based on your previous session's performance
- You can:
  - **Accept**: Use the suggested times (they'll be pre-filled in the form)
  - **Dismiss**: Ignore the suggestion and set your own times

## API Endpoints Used

The dashboard now uses these new endpoints:

- `POST /api/time-block/start` - Start time block session
- `GET /api/time-block/current` - Get current session status
- `POST /api/time-block/end` - End session (auto-sync + metrics)
- `GET /api/time-block/suggestion` - Get next session suggestion
- `POST /api/time-block/pause` - Pause session
- `POST /api/time-block/resume` - Resume session
- `GET /api/time-block/recommendation` - Get real-time recommendation

## Praboth Integration

### Requirements

1. **Praboth Service Running**: The praboth service should be running at `http://localhost:8000`
2. **OS Hooks**: For real-time data collection, run the OS hooks:
   ```powershell
   .\.venv\Scripts\cle-os-hooks.exe --endpoint http://127.0.0.1:8000/events
   ```

### What You'll See

- **Connection Status**: Shows whether praboth is connected
- **Real-time Cognitive Load**: Updates every 15 seconds from praboth `/estimate` endpoint
- **Automatic Updates**: Cognitive load is automatically used in recommendations

## Workflow Example

1. **First Session**:
   - Set time block: 2pm - 4pm
   - Start session
   - Study during the session (praboth collects data)
   - End session → Data syncs, metrics computed

2. **Second Session**:
   - System suggests: "Based on your performance, try 25min work / 8min breaks"
   - Accept suggestion or set your own time block
   - Start session → System uses previous metrics to adapt schedule
   - Continue the loop...

## Troubleshooting

### Praboth Not Connected

- **Check**: Is praboth service running at `http://localhost:8000`?
- **Check**: Can you access `http://localhost:8000/health`?
- **Solution**: Start praboth service:
  ```powershell
  cd praboth
  .\.venv\Scripts\cog-py-est.exe --config policy_1.toml
  ```

### No Suggestions After Session

- **Check**: Did the session sync successfully?
- **Check**: Are there metrics computed? (Check "Load Metrics" button)
- **Solution**: Make sure you have at least one completed session with data

### Session Not Starting

- **Check**: Is the API server running at `http://127.0.0.1:5000`?
- **Check**: Are start/end times valid? (End time must be after start time)
- **Solution**: Start the API server:
  ```powershell
  python run_server.py
  ```

## Features

### Real-time Features
- ✅ Cognitive load from praboth (updates every 15s)
- ✅ Real-time recommendations
- ✅ Session status updates
- ✅ Timer countdown

### Automatic Features
- ✅ Auto-sync praboth data after session
- ✅ Auto-compute metrics after sync
- ✅ Auto-generate next session suggestions
- ✅ Auto-update cognitive load display

### Manual Features
- ✅ Pause/Resume session
- ✅ End intervals manually
- ✅ Get recommendations on demand
- ✅ Load metrics manually

## Next Steps

1. **Start Both Services**:
   - Adaptive Scheduler API: `python run_server.py`
   - Praboth Service: `cd praboth && .\.venv\Scripts\cog-py-est.exe --config policy_1.toml`
   - OS Hooks (optional): `cd praboth && .\.venv\Scripts\cle-os-hooks.exe --endpoint http://127.0.0.1:8000/events`

2. **Open Dashboard**: `http://127.0.0.1:5000/dashboard`

3. **Start Your First Session**: Set a time block and start studying!

4. **View Results**: After ending sessions, check metrics and suggestions


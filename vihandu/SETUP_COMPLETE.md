# Praboth Setup Complete! ✅

## What's Ready

✅ **Praboth service installed and configured**
- Virtual environment created
- All dependencies installed
- Config file ready (policy_1.toml)
- Database will be created at: `praboth/data/state.db`

✅ **Integration scripts ready**
- `setup_praboth.py` - Install praboth (already run)
- `run_praboth.py` - Start praboth service
- `start_praboth.ps1` - PowerShell script to start praboth
- `run_workflow.py` - Complete workflow (sync data → metrics → schedule)

## How to Use

### Step 1: Start Praboth Service

To collect real session data, start the praboth service:

**Option A: Using Python script**
```bash
python run_praboth.py
```

**Option B: Using PowerShell**
```powershell
powershell -ExecutionPolicy Bypass -File start_praboth.ps1
```

**Option C: Manual**
```bash
cd praboth
.venv\Scripts\cog-py-est.exe --config policy_1.toml
```

The service will:
- Start API server at `http://127.0.0.1:8000`
- Create database at `praboth/data/state.db`
- Begin collecting session data when events are sent

### Step 2: Collect Data (Optional - if using hooks)

To capture keyboard/mouse events, you can start the OS hooks:

```bash
cd praboth
.venv\Scripts\cle-os-hooks.exe --endpoint http://127.0.0.1:8000/events
```

Or use the start_all script:
```powershell
cd praboth
powershell -ExecutionPolicy Bypass -File start_all.ps1 -WithHooks
```

### Step 3: After Praboth Has Collected Data

Once praboth has collected session data, run the workflow:

```bash
python run_workflow.py
```

This will:
1. ✅ Find praboth database
2. ✅ Sync praboth sessions to adaptive scheduler
3. ✅ Compute metrics from real data
4. ✅ Create adapted schedule for next session

## Quick Test

Test that everything is set up correctly:

```bash
python test_integration.py
```

This will verify:
- ✅ All imports work
- ✅ Database paths are correct
- ✅ Schedule creation works

## Files Created

- `setup_praboth.py` - Setup script (already run)
- `run_praboth.py` - Start praboth service
- `start_praboth.ps1` - PowerShell start script
- `run_workflow.py` - Complete workflow script
- `test_integration.py` - Integration test

## Next Steps

1. **Start praboth service** to begin collecting data
2. **Let it run** and collect session data
3. **Run workflow** to sync data and compute metrics
4. **Use metrics** to adapt future session schedules

## Database Location

- **Praboth database**: `praboth/data/state.db` (created when service starts)
- **Adaptive scheduler database**: `adaptive_scheduler.db` (already exists)

## API Endpoints (when praboth is running)

- `GET http://127.0.0.1:8000/estimate` - Get cognitive load estimate
- `GET http://127.0.0.1:8000/telemetry` - Get telemetry data
- `POST http://127.0.0.1:8000/events` - Send events (used by hooks)

## Integration Flow

```
Start Praboth → Collect Data → Run Workflow → Compute Metrics → Create Schedule
```

You're all set! 🚀












# Tools

This directory contains utility scripts for `cog_py_est`.

## Export Teammate Data

`exporter.py` handles the extraction of feature matrices and linked context/EMA responses into a persistent SQLite database for analysis.

### Usage

**Primary Method (Automatic):**
Simply run the main service. Data is automatically exported to `yuvindu_data.db` when you stop the session (Ctrl+C).

```powershell
python -m cog_py_est.cli
```

**Manual Fallback:**
If you need to trigger an export manually without running the service:

```powershell
python -m cog_py_est.exporter
```

_(Ensure you are in the project root directory)_

### Output

The script maintains `yuvindu_data.db` in the current directory. It incrementally appends new session data to the `exported_metrics` table.

**Schema:**

| Column                     | Type    | Description                                                |
| :------------------------- | :------ | :--------------------------------------------------------- |
| `session_id`               | INTEGER | ID of the recording session                                |
| `window_start`             | TEXT    | ISO8601 timestamp of window start                          |
| `window_end`               | TEXT    | ISO8601 timestamp of window end                            |
| `block_focus`              | TEXT    | The app in focus during the window (from system snapshots) |
| `keystroke_intervals_mean` | REAL    | Average IKI (Inter-Key Interval) in ms                     |
| `burstiness`               | REAL    | Standard deviation of IKI (ms)                             |
| `scroll_rate`              | REAL    | Proxy for scroll/movement speed (pixels/ms)                |
| `idle_time_percent`        | REAL    | Fraction of window spent idle (0.0 - 1.0)                  |
| `microEMA_rating`          | INTEGER | 1-7 Likert scale rating (if a prompt was answered)         |
| `microEMA_note`            | TEXT    | Optional text note from the user response                  |

### Verification

You can open the output file using any SQLite viewer (e.g., `DB Browser for SQLite`) or query it with Python:

```python
import sqlite3
conn = sqlite3.connect("yuvindu_data.db")
cursor = conn.cursor()
cursor.execute("SELECT * FROM exported_metrics LIMIT 5")
print(cursor.fetchall())
```

### Data Management (CRUD)

You can programmatically manage the exported data using the `DataManager` class in `exporter.py`.

```python
from cog_py_est.exporter import DataManager

# Initialize manager (defaults to yuvindu_data.db)
dm = DataManager()

# 1. READ: Get last 5 sessions
latest = dm.read(limit=5)
print(f"Found {len(latest)} records")

# 2. READ: Filter by session_id
session_1_data = dm.read(session_id=1)

# 3. CREATE: Add manual entry (returns rowid)
new_id = dm.create(
    session_id=999,
    window_start="2025-01-01T12:00:00",
    window_end="2025-01-01T12:01:00",
    block_focus="manual_entry",
    keystroke_intervals_mean=500.0
)
print(f"Created record with rowid: {new_id}")

# 4. UPDATE: Modify a record by rowid
dm.update(row_id=new_id, microEMA_note="Updated manually")

# 5. DELETE: Remove records by filter
deleted_count = dm.delete(session_id=999)
print(f"Deleted {deleted_count} records")
```

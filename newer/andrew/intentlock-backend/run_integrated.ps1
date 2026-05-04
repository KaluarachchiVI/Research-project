# Run Intent-Lock backend on port 8001 (for integration with CLE on 8000)
# Usage: .\run_integrated.ps1   or   powershell -ExecutionPolicy Bypass -File run_integrated.ps1
# Requires: pip install -r requirements.txt   (or activate venv first)
python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload

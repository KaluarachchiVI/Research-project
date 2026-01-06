"""
Simple script to start praboth service
"""
import subprocess
import sys
from pathlib import Path

def main():
    project_root = Path(__file__).parent
    praboth_dir = project_root / "praboth"
    venv_python = praboth_dir / ".venv" / "Scripts" / "python.exe"
    config_file = praboth_dir / "policy_1.toml"
    
    if not venv_python.exists():
        print("ERROR: Praboth virtual environment not found.")
        print("Run 'python setup_praboth.py' first.")
        sys.exit(1)
    
    if not config_file.exists():
        print(f"ERROR: Config file not found: {config_file}")
        sys.exit(1)
    
    print("=" * 70)
    print("Starting Praboth Service")
    print("=" * 70)
    print(f"\nConfig: {config_file}")
    print("API will be available at: http://127.0.0.1:8000")
    print("\nDatabase will be created at: praboth/data/state.db")
    print("\nTo stop, press Ctrl+C\n")
    print("-" * 70)
    print()
    
    # Run praboth
    try:
        subprocess.run(
            [str(venv_python), "-m", "cog_py_est.cli", "--config", "policy_1.toml"],
            cwd=str(praboth_dir)
        )
    except KeyboardInterrupt:
        print("\n\nService stopped.")

if __name__ == "__main__":
    main()












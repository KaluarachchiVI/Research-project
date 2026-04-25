"""
Setup script to install and configure praboth service
"""
import subprocess
import sys
from pathlib import Path
import os

def run_command(cmd, cwd=None, check=True):
    """Run a shell command"""
    print(f"\n{'='*70}")
    print(f"Running: {cmd}")
    print(f"{'='*70}\n")
    result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    if check and result.returncode != 0:
        print(f"\nCommand failed with exit code {result.returncode}")
        sys.exit(1)
    return result

def main():
    project_root = Path(__file__).parent
    praboth_dir = project_root / "praboth"
    
    if not praboth_dir.exists():
        print(f"ERROR: Praboth directory not found at {praboth_dir}")
        sys.exit(1)
    
    print("=" * 70)
    print("PRABOTH SETUP")
    print("=" * 70)
    print(f"\nSetting up praboth in: {praboth_dir}")
    
    # Check if venv already exists
    venv_path = praboth_dir / ".venv"
    venv_scripts = venv_path / "Scripts"
    
    if not venv_path.exists():
        print("\n1. Creating virtual environment...")
        run_command(f'python -m venv .venv', cwd=praboth_dir)
    else:
        print("\n1. Virtual environment already exists, skipping...")
    
    # Determine Python executable in venv
    if sys.platform == 'win32':
        python_exe = venv_scripts / "python.exe"
        pip_exe = venv_scripts / "pip.exe"
    else:
        python_exe = venv_path / "bin" / "python"
        pip_exe = venv_path / "bin" / "pip"
    
    print("\n2. Upgrading pip...")
    try:
        run_command(f'"{python_exe}" -m pip install --upgrade pip', cwd=praboth_dir, check=False)
    except:
        print("   (pip upgrade skipped - using existing version)")
    
    print("\n3. Installing praboth...")
    run_command(f'"{python_exe}" -m pip install .', cwd=praboth_dir)
    
    print("\n4. Installing hooks (optional, for keyboard/mouse capture)...")
    result = run_command(f'"{python_exe}" -m pip install ".[hooks]"', cwd=praboth_dir, check=False)
    if result.returncode != 0:
        print("   (Hooks installation skipped - this is optional)")
    
    print("\n5. Checking configuration...")
    config_file = praboth_dir / "policy_1.toml"
    if config_file.exists():
        print(f"   [OK] Config file found: {config_file}")
    else:
        print(f"   [WARNING] Config file not found: {config_file}")
        print("   Creating data directory...")
        data_dir = praboth_dir / "data"
        data_dir.mkdir(exist_ok=True)
    
    print("\n" + "=" * 70)
    print("SETUP COMPLETE!")
    print("=" * 70)
    
    print("\nTo run praboth service:")
    print(f"  cd praboth")
    if sys.platform == 'win32':
        print(f'  .venv\\Scripts\\cog-py-est.exe --config policy_1.toml')
    else:
        print(f'  .venv/bin/cog-py-est --config policy_1.toml')
    
    print("\nOr use the start script:")
    print(f"  cd praboth")
    print(f"  powershell -ExecutionPolicy Bypass -File start_all.ps1")

if __name__ == "__main__":
    main()


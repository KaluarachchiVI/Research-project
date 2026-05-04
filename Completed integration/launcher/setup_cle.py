"""
Setup script: create venv and install the Cognitive Load Estimator (CLE) package
from ../cognitive-load-estimator (formerly under newer/praboth).
"""
import subprocess
import sys
from pathlib import Path


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
    launcher_dir = Path(__file__).parent.resolve()
    integration_root = launcher_dir.parent
    cle_dir = integration_root / "cognitive-load-estimator"

    if not cle_dir.exists():
        print(f"ERROR: cognitive-load-estimator not found at {cle_dir}")
        sys.exit(1)

    print("=" * 70)
    print("CLE (COGNITIVE LOAD ESTIMATOR) SETUP")
    print("=" * 70)
    print(f"\nInstalling CLE package from: {cle_dir}")

    venv_path = cle_dir / ".venv"
    if sys.platform == "win32":
        venv_scripts = venv_path / "Scripts"
        python_exe = venv_scripts / "python.exe"
        pip_exe = venv_scripts / "pip.exe"
    else:
        venv_scripts = venv_path / "bin"
        python_exe = venv_path / "bin" / "python"
        pip_exe = venv_path / "bin" / "pip"

    if not venv_path.exists():
        print("\n1. Creating virtual environment...")
        run_command("python -m venv .venv", cwd=cle_dir)
    else:
        print("\n1. Virtual environment already exists, skipping...")

    print("\n2. Upgrading pip...")
    try:
        run_command(f'"{python_exe}" -m pip install --upgrade pip', cwd=cle_dir, check=False)
    except Exception:
        print("   (pip upgrade skipped - using existing version)")

    # Always editable-install so pyproject/entry-point fixes apply after upgrades.
    # If cog-py-est.exe is locked (running), this may fail on Windows — stop CLE and re-run.
    print("\n3. Installing / upgrading CLE package (editable)...")
    run_command(f'"{python_exe}" -m pip install -e .', cwd=cle_dir)

    print("\n4. Installing hooks (keyboard/mouse + httpx for cle-os-hooks)...")
    result = run_command(f'"{python_exe}" -m pip install -e ".[hooks]"', cwd=cle_dir, check=False)
    if result.returncode != 0:
        print("   (Hooks install failed — optional; OS hooks will not work until this succeeds)")

    print("\n5. Checking configuration...")
    config_file = cle_dir / "policy_1.toml"
    if config_file.exists():
        print(f"   [OK] Config file found: {config_file}")
    else:
        print(f"   [WARNING] Config file not found: {config_file}")
        data_dir = cle_dir / "data"
        data_dir.mkdir(exist_ok=True)
        print("   [OK] Created data directory.")

    print("\n" + "=" * 70)
    print("SETUP COMPLETE!")
    print("=" * 70)

    print("\nTo run CLE service manually:")
    print(f"  cd {cle_dir}")
    if sys.platform == "win32":
        print(r"  .\.venv\Scripts\python.exe -m cog_py_est.cli --config policy_1.toml")
    else:
        print("  .venv/bin/python -m cog_py_est.cli --config policy_1.toml")

    print("\nOr use the integrated launcher from this folder:")
    print(r"  .\start-all.ps1 -WithServer -WithHooks")


if __name__ == "__main__":
    main()

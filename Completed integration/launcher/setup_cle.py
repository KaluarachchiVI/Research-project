"""
Setup script: create venv and install the Cognitive Load Estimator (CLE) package
from ../cognitive-load-estimator (formerly under newer/praboth).
"""
import shutil
import subprocess
import sys
import time
from pathlib import Path


def _venv_python_runs(python_exe: Path, cle_dir: Path) -> bool:
    """True if this interpreter starts (avoids host .venv with wrong pyvenv.cfg home in Sandbox)."""
    if not python_exe.is_file():
        return False
    try:
        r = subprocess.run(
            [str(python_exe), "-c", "import sys; sys.exit(0)"],
            cwd=str(cle_dir),
            capture_output=True,
            text=True,
            timeout=90,
        )
    except (OSError, subprocess.TimeoutExpired):
        return False
    return r.returncode == 0


def pip_install_retry(
    python_exe: Path,
    cle_dir: Path,
    label: str,
    pip_install_tail: str,
    attempts: int = 6,
    exit_on_fail: bool = True,
) -> subprocess.CompletedProcess:
    """Windows often returns WinError 32 if cle-os-hooks.exe / console scripts are still open."""
    last: subprocess.CompletedProcess | None = None
    for i in range(attempts):
        cmd = f'"{python_exe}" -m pip install {pip_install_tail}'
        print(f"\n[{label}] attempt {i + 1}/{attempts}")
        last = subprocess.run(cmd, shell=True, cwd=str(cle_dir), capture_output=True, text=True)
        if last.stdout:
            print(last.stdout)
        if last.stderr:
            print(last.stderr, file=sys.stderr)
        if last.returncode == 0:
            return last
        err = (last.stderr or "") + (last.stdout or "")
        if sys.platform == "win32" and ("WinError 32" in err or "being used by another process" in err):
            wait = 8 + i * 4
            print(f"   File in use (WinError 32); waiting {wait}s before retry...")
            time.sleep(wait)
            continue
        if exit_on_fail:
            print(f"\nCommand failed with exit code {last.returncode}")
            sys.exit(last.returncode)
        return last
    if exit_on_fail:
        print(f"\nCommand failed after {attempts} attempts (last exit {last.returncode if last else '?'})")
        sys.exit(last.returncode if last else 1)
    return last if last else subprocess.CompletedProcess(args="", returncode=1)


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

    if venv_path.exists() and not _venv_python_runs(python_exe, cle_dir):
        print(
            "\n1. Existing .venv is not usable here (wrong base Python, e.g. host path). "
            "Removing and recreating..."
        )
        try:
            shutil.rmtree(venv_path)
        except OSError as e:
            print(f"ERROR: could not remove broken .venv: {e}")
            sys.exit(1)

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

    print("\n3. Installing CLE package (editable install from pyproject)...")
    pip_install_retry(python_exe, cle_dir, "pip install .", ".", exit_on_fail=True)

    print("\n4. Installing hooks (optional, for keyboard/mouse capture)...")
    result = pip_install_retry(
        python_exe, cle_dir, 'pip install ".[hooks]"', '".[hooks]"', exit_on_fail=False
    )
    if result.returncode != 0:
        print("   (Hooks installation skipped - this is optional)")

    print("\n5. Checking configuration...")
    config_file = cle_dir / "policy_1.toml"
    if config_file.exists():
        print(f"   [OK] Config file found: {config_file}")
    else:
        print(f"   [WARNING] Config file not found: {config_file}")
        data_dir = cle_dir / "data"
        data_dir.mkdir(exist_ok=True)
        print("   Created data directory.")

    print("\n" + "=" * 70)
    print("SETUP COMPLETE!")
    print("=" * 70)

    print("\nTo run CLE service manually:")
    print(f"  cd {cle_dir}")
    if sys.platform == "win32":
        print(r"  .\.venv\Scripts\cog-py-est.exe --config policy_1.toml")
    else:
        print("  .venv/bin/cog-py-est --config policy_1.toml")

    print("\nOr use the integrated launcher from this folder:")
    print(r"  .\start-all.ps1 -WithServer -WithHooks")


if __name__ == "__main__":
    main()

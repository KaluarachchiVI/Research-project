"""Setup script to install and configure the root-level `praboth/` CLE backend.

This is intentionally separate from `setup_cle.py`:
- `setup_cle.py` bootstraps `../cognitive-load-estimator` (cog-py-est)
- this script bootstraps `../../praboth` (praboth-backend)

It is used by `start-all.ps1 -UsePrabothCle`.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def run_command(cmd: str, cwd: Path, check: bool = True) -> subprocess.CompletedProcess[str]:
    print("\n" + "=" * 70)
    print(f"Running: {cmd}")
    print("=" * 70 + "\n")
    result = subprocess.run(cmd, shell=True, cwd=str(cwd), capture_output=True, text=True)
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    if check and result.returncode != 0:
        print(f"\nCommand failed with exit code {result.returncode}")
        sys.exit(result.returncode)
    return result


def main() -> int:
    launcher_dir = Path(__file__).resolve().parent
    repo_root = launcher_dir.parent.parent
    praboth_dir = repo_root / "praboth"

    if not praboth_dir.exists():
        print(f"ERROR: root praboth directory not found at: {praboth_dir}")
        return 1

    venv_path = praboth_dir / ".venv"
    scripts_dir = venv_path / "Scripts"

    if not venv_path.exists():
        print("1) Creating virtual environment for root praboth...")
        run_command("python -m venv .venv", cwd=praboth_dir)
    else:
        print("1) Virtual environment already exists, skipping...")

    python_exe = scripts_dir / "python.exe" if sys.platform == "win32" else venv_path / "bin" / "python"

    if not python_exe.exists():
        print(f"ERROR: venv python not found at: {python_exe}")
        print("Try deleting praboth/.venv and re-running setup.")
        return 1

    print("2) Upgrading pip...")
    run_command(f'"{python_exe}" -m pip install --upgrade pip', cwd=praboth_dir, check=False)

    print("3) Installing root praboth backend...")
    run_command(f'"{python_exe}" -m pip install -e .', cwd=praboth_dir)

    print("4) Installing hooks (optional)...")
    run_command(f'"{python_exe}" -m pip install -e ".[hooks]"', cwd=praboth_dir, check=False)

    print("\nSetup complete for root praboth CLE backend.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Command-line entry point for the estimator service."""

from __future__ import annotations

import argparse
from pathlib import Path

import uvicorn

from backend.src.api.app import create_app
from backend.src.core.config import AppConfig


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Cognitive load estimator (Python)")
    parser.add_argument(
        "--config",
        type=Path,
        default=None,
        help="Path to TOML config (defaults to bundled example values)",
    )
    parser.add_argument("--host", type=str, default=None, help="Override bind host")
    parser.add_argument("--port", type=int, default=None, help="Override bind port")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = AppConfig.load(args.config)
    host = args.host or config.service.host
    port = args.port or config.service.port
    app = create_app(args.config)
    
    print("\n" + "="*60)
    print(" C O G N I T I V E   L O A D   E S T I M A T O R")
    print("="*60)
    print(" Service running on http://{}:{}".format(host, port))
    print(" Press Ctrl+C to stop the session and export data.")
    print("="*60 + "\n")
    
    try:
        uvicorn.run(app, host=host, port=port)
    except KeyboardInterrupt:
        pass
    
    print("\n" + "="*60)
    print(" Session stopped. Data export handled by service shutdown.")
    print(" Check 'yuvindu_data.db' for results.")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()

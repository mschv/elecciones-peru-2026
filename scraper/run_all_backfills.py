"""
run_all_backfills.py — Run all backfill scripts in the correct order.

Order:
  1. backfill_anotaciones.py   — safe, no deletions (preview first)
  2. backfill_ingresos.py      — safe, upsert only
  3. backfill_bienes.py        — safe, clears + re-inserts per candidate
  4. backfill_cargo_eleccion.py — safe, clears + re-inserts per candidate
  5. backfill_education_fix.py  — safe, updates existing records
  6. backfill_sentencias.py    — LAST: deletes ALL old procesos data first

Usage:
    cd scraper
    python3 run_all_backfills.py

    # Skip sentencias (run manually after reviewing data):
    python3 run_all_backfills.py --skip-sentencias

    # Run only a specific script:
    python3 run_all_backfills.py --only sentencias
"""

from __future__ import annotations

import sys
import subprocess
from datetime import datetime


SCRIPTS = [
    ("anotaciones",    "backfill_anotaciones.py"),
    ("ingresos",       "backfill_ingresos.py"),
    ("bienes",         "backfill_bienes.py"),
    ("cargo_eleccion", "backfill_cargo_eleccion.py"),
    ("education_fix",  "backfill_education_fix.py"),
    ("sentencias",     "backfill_sentencias.py"),
]


def run_script(name: str, script: str) -> bool:
    print(f"\n{'='*60}")
    print(f"  [{datetime.now().strftime('%H:%M:%S')}] Running {script}…")
    print(f"{'='*60}")
    result = subprocess.run(["python3", script], check=False)
    if result.returncode != 0:
        print(f"\n  ⚠  {script} exited with code {result.returncode}")
        return False
    return True


def main() -> None:
    args = sys.argv[1:]
    skip_sentencias = "--skip-sentencias" in args
    only_arg = next((a.split("=")[1] for a in args if a.startswith("--only=")), None)
    if "--only" in args:
        idx = args.index("--only")
        only_arg = args[idx + 1] if idx + 1 < len(args) else None

    to_run = [
        (name, script) for name, script in SCRIPTS
        if (only_arg is None or only_arg == name)
        and not (skip_sentencias and name == "sentencias")
    ]

    if not to_run:
        print("No scripts to run.")
        return

    print(f"Running {len(to_run)} backfill script(s):")
    for name, script in to_run:
        print(f"  • {script}")

    if any(name == "sentencias" for name, _ in to_run):
        print("\n⚠  backfill_sentencias.py will DELETE all existing procesos_judiciales.")
        print("   Make sure you have reviewed the raw lSentenciaPenal data first.")
        confirm = input("   Type 'yes' to proceed: ").strip().lower()
        if confirm != "yes":
            print("   Aborted.")
            return

    start = datetime.now()
    failed = []

    for name, script in to_run:
        ok = run_script(name, script)
        if not ok:
            failed.append(script)
            cont = input(f"\n  {script} failed. Continue anyway? [y/N] ").strip().lower()
            if cont != "y":
                print("  Stopping.")
                break

    elapsed = (datetime.now() - start).seconds
    print(f"\n{'='*60}")
    print(f"  Finished in {elapsed}s")
    if failed:
        print(f"  Failed: {', '.join(failed)}")
    else:
        print("  All scripts completed successfully.")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()

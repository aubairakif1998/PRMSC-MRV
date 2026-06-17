#!/usr/bin/env python3
"""
Backfill ``water_energy_logging_daily`` meter columns from legacy cumulative readings.

Legacy behaviour: operators entered cumulative bulk-meter stop readings in
``total_water_pumped``. The new schema stores:
  - meter_reading_end   — cumulative reading at pump stop
  - meter_reading_start — initial reading (first log) or previous stop reading
  - total_water_pumped  — interval volume (end − start)

Usage (from ``backend/``):

  # Preview planned changes (default)
  python3 scripts/backfill_water_meter_readings.py

  # Apply to database
  python3 scripts/backfill_water_meter_readings.py --apply

  # One water system only
  python3 scripts/backfill_water_meter_readings.py --apply --system-id <uuid>

  # Show every row change
  python3 scripts/backfill_water_meter_readings.py --verbose
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app import create_app  # noqa: E402
from app.extensions import db  # noqa: E402
from app.utils.water_meter_backfill import (  # noqa: E402
    apply_meter_corrections,
    plan_meter_corrections,
)


def _fmt(value: float | None) -> str:
    if value is None:
        return "—"
    return f"{value:.4g}"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Backfill water log meter_reading_start/end from legacy cumulative readings.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write changes to the database (default is dry-run only).",
    )
    parser.add_argument(
        "--system-id",
        metavar="UUID",
        help="Limit correction to a single water_systems.id",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print each planned row change.",
    )
    args = parser.parse_args()

    app = create_app()
    with app.app_context():
        corrections, issues = plan_meter_corrections(system_id=args.system_id)

        print(f"Planned row updates: {len(corrections)}")
        print(f"Issues (skipped rows): {len(issues)}")

        if args.verbose and corrections:
            print("\n--- Planned corrections ---")
            for row in corrections:
                print(
                    f"\nlog {row.log_id}  system {row.water_system_id}  date {row.log_date}"
                )
                print(f"  note: {row.note}")
                print(
                    f"  start: {_fmt(row.old_meter_reading_start)} → {_fmt(row.new_meter_reading_start)}"
                )
                print(
                    f"  end:   {_fmt(row.old_meter_reading_end)} → {_fmt(row.new_meter_reading_end)}"
                )
                print(
                    f"  total: {_fmt(row.old_total_water_pumped)} → {_fmt(row.new_total_water_pumped)} m³"
                )

        if issues:
            print("\n--- Issues ---")
            for issue in issues[:50]:
                print(
                    f"  log {issue.log_id} ({issue.log_date}): {issue.message}"
                )
            if len(issues) > 50:
                print(f"  … and {len(issues) - 50} more")

        if not args.apply:
            if corrections:
                print("\nDry run only — re-run with --apply to persist changes.")
            return 0

        if not corrections:
            print("\nNothing to update.")
            return 0

        updated = apply_meter_corrections(corrections)
        db.session.commit()
        print(f"\nApplied {updated} row update(s).")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())

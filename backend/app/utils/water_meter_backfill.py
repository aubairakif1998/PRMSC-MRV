"""Plan and apply legacy water-log meter field corrections.

Legacy rows stored cumulative bulk-meter stop readings in ``total_water_pumped``.
The new schema stores:
  - ``meter_reading_end``   — cumulative reading at pump stop
  - ``meter_reading_start`` — baseline (initial reading or previous stop)
  - ``total_water_pumped``  — interval m³ (end − start)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from app.models.models import (
    SUBMISSION_STATUS_REJECTED,
    WaterEnergyLoggingDaily,
    WaterSystem,
)
from app.utils.water_meter_volume import sort_water_logs


@dataclass
class MeterCorrection:
    log_id: str
    water_system_id: str
    log_date: str | None
    old_meter_reading_start: float | None
    old_meter_reading_end: float | None
    old_total_water_pumped: float | None
    new_meter_reading_start: float | None
    new_meter_reading_end: float | None
    new_total_water_pumped: float | None
    note: str = ""


@dataclass
class MeterCorrectionIssue:
    log_id: str
    water_system_id: str
    log_date: str | None
    message: str


def _is_rejected(log: WaterEnergyLoggingDaily) -> bool:
    return log.status == SUBMISSION_STATUS_REJECTED


def _float_or_none(value: float | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _values_differ(a: float | None, b: float | None, *, epsilon: float = 1e-6) -> bool:
    if a is None and b is None:
        return False
    if a is None or b is None:
        return True
    return abs(float(a) - float(b)) > epsilon


def _cumulative_stop_reading(log: WaterEnergyLoggingDaily) -> float | None:
    """Resolve cumulative meter reading at pump stop for legacy or new rows."""
    if log.meter_reading_end is not None:
        return float(log.meter_reading_end)
    if log.meter_reading_start is not None and log.total_water_pumped is not None:
        return float(log.meter_reading_start) + float(log.total_water_pumped)
    if log.total_water_pumped is not None:
        return float(log.total_water_pumped)
    return None


def plan_meter_corrections_for_logs(
    logs: Iterable[WaterEnergyLoggingDaily],
    *,
    bulk_meter_installed: bool,
) -> tuple[list[MeterCorrection], list[MeterCorrectionIssue]]:
    """Return planned row updates and non-fatal issues for one water system."""
    corrections: list[MeterCorrection] = []
    issues: list[MeterCorrectionIssue] = []

    ordered = sort_water_logs(logs)
    if not bulk_meter_installed:
        for log in ordered:
            if _is_rejected(log):
                continue
            if (
                log.meter_reading_start is not None
                or log.meter_reading_end is not None
                or log.total_water_pumped is not None
            ):
                corrections.append(
                    MeterCorrection(
                        log_id=str(log.id),
                        water_system_id=str(log.water_system_id),
                        log_date=log.log_date.isoformat() if log.log_date else None,
                        old_meter_reading_start=_float_or_none(log.meter_reading_start),
                        old_meter_reading_end=_float_or_none(log.meter_reading_end),
                        old_total_water_pumped=_float_or_none(log.total_water_pumped),
                        new_meter_reading_start=None,
                        new_meter_reading_end=None,
                        new_total_water_pumped=None,
                        note="No bulk meter — clear meter/volume fields",
                    )
                )
        return corrections, issues

    prev_end: float | None = None
    for log in ordered:
        if _is_rejected(log):
            continue

        cumulative_end = _cumulative_stop_reading(log)
        if cumulative_end is None:
            continue

        new_end = cumulative_end
        new_start: float | None
        new_total: float | None
        note = ""

        if prev_end is None:
            if log.meter_reading_start is not None:
                new_start = float(log.meter_reading_start)
                new_total = (
                    new_end - new_start if new_end > new_start else None
                )
                if new_total is None:
                    issues.append(
                        MeterCorrectionIssue(
                            log_id=str(log.id),
                            water_system_id=str(log.water_system_id),
                            log_date=log.log_date.isoformat() if log.log_date else None,
                            message=(
                                f"First log stop reading ({new_end}) is not greater than "
                                f"stored initial reading ({new_start})"
                            ),
                        )
                    )
                    continue
                note = "First log — interval from stored initial reading"
            else:
                new_start = None
                new_total = None
                note = (
                    "First log — only stop reading known; interval left empty "
                    "(no initial reading on record)"
                )
        elif new_end <= prev_end:
            issues.append(
                MeterCorrectionIssue(
                    log_id=str(log.id),
                    water_system_id=str(log.water_system_id),
                    log_date=log.log_date.isoformat() if log.log_date else None,
                    message=(
                        f"Non-monotonic cumulative reading: stop {new_end} "
                        f"<= previous stop {prev_end}"
                    ),
                )
            )
            continue
        else:
            new_start = prev_end
            new_total = new_end - new_start
            note = "Interval from previous stop reading"

        if (
            _values_differ(log.meter_reading_start, new_start)
            or _values_differ(log.meter_reading_end, new_end)
            or _values_differ(log.total_water_pumped, new_total)
        ):
            corrections.append(
                MeterCorrection(
                    log_id=str(log.id),
                    water_system_id=str(log.water_system_id),
                    log_date=log.log_date.isoformat() if log.log_date else None,
                    old_meter_reading_start=_float_or_none(log.meter_reading_start),
                    old_meter_reading_end=_float_or_none(log.meter_reading_end),
                    old_total_water_pumped=_float_or_none(log.total_water_pumped),
                    new_meter_reading_start=new_start,
                    new_meter_reading_end=new_end,
                    new_total_water_pumped=new_total,
                    note=note,
                )
            )

        prev_end = new_end

    return corrections, issues


def plan_meter_corrections(
    *,
    system_id: str | None = None,
) -> tuple[list[MeterCorrection], list[MeterCorrectionIssue]]:
    """Plan corrections for all water systems (or one system)."""
    q = WaterSystem.query.order_by(
        WaterSystem.tehsil, WaterSystem.village, WaterSystem.unique_identifier
    )
    if system_id:
        q = q.filter(WaterSystem.id == system_id)
    systems = q.all()

    all_corrections: list[MeterCorrection] = []
    all_issues: list[MeterCorrectionIssue] = []
    for system in systems:
        logs = (
            WaterEnergyLoggingDaily.query.filter_by(water_system_id=system.id)
            .order_by(WaterEnergyLoggingDaily.log_date)
            .all()
        )
        bulk = getattr(system, "bulk_meter_installed", True) is not False
        corrections, issues = plan_meter_corrections_for_logs(
            logs, bulk_meter_installed=bulk
        )
        all_corrections.extend(corrections)
        all_issues.extend(issues)
    return all_corrections, all_issues


def apply_meter_corrections(corrections: Iterable[MeterCorrection]) -> int:
    """Persist planned corrections. Returns number of rows updated."""
    updated = 0
    for item in corrections:
        log = WaterEnergyLoggingDaily.query.get(item.log_id)
        if not log:
            continue
        log.meter_reading_start = item.new_meter_reading_start
        log.meter_reading_end = item.new_meter_reading_end
        log.total_water_pumped = item.new_total_water_pumped
        updated += 1
    return updated

"""Bulk-meter interval volume: cumulative readings → m³ pumped per log."""

from __future__ import annotations

from datetime import date, datetime, time
from typing import Iterable

from sqlalchemy import and_, or_

from app.extensions import db
from app.models.models import (
    SUBMISSION_STATUS_ACCEPTED,
    SUBMISSION_STATUS_REJECTED,
    SUBMISSION_STATUS_REVERTED_BACK,
    SUBMISSION_STATUS_SUBMITTED,
    WaterEnergyLoggingDaily,
)


class MeterReadingOrderError(ValueError):
    """Pump-stop reading is not greater than the prior submitted reading on this system."""

    code = "meter_reading_order"

    def __init__(self, end_val: float, base_val: float) -> None:
        self.end_val = end_val
        self.base_val = base_val
        super().__init__(
            f"Meter reading at pump stop ({end_val} m³) must be greater than the previous "
            f"submitted reading ({base_val} m³) for this water system."
        )


def _log_not_rejected():
    return or_(
        WaterEnergyLoggingDaily.status.is_(None),
        WaterEnergyLoggingDaily.status != SUBMISSION_STATUS_REJECTED,
    )


def _log_for_meter_chain():
    """Submitted history on the meter chain (not drafts or rejected)."""
    return or_(
        WaterEnergyLoggingDaily.status.is_(None),
        WaterEnergyLoggingDaily.status.in_(
            (
                SUBMISSION_STATUS_SUBMITTED,
                SUBMISSION_STATUS_ACCEPTED,
                SUBMISSION_STATUS_REVERTED_BACK,
            )
        ),
    )


def water_log_sort_key(record: WaterEnergyLoggingDaily) -> tuple:
    log_d = record.log_date or date.min
    end_t = record.pump_end_time or time.min
    start_t = record.pump_start_time or time.min
    created = record.created_at or datetime.min
    return (log_d, end_t, start_t, created, str(record.id))


def sort_water_logs(
    logs: Iterable[WaterEnergyLoggingDaily],
) -> list[WaterEnergyLoggingDaily]:
    return sorted(logs, key=water_log_sort_key)


def _reading_end_value(record: WaterEnergyLoggingDaily) -> float | None:
    if record.meter_reading_end is not None:
        return float(record.meter_reading_end)
    if record.total_water_pumped is not None:
        return float(record.total_water_pumped)
    return None


def interval_volume_from_log(
    record: WaterEnergyLoggingDaily,
    previous_end: float | None,
) -> tuple[float | None, float | None]:
    """
    Return (interval_m3, new_previous_end) for one log in chronological order.

  When `meter_reading_end` is stored, `total_water_pumped` is the trusted interval.
  Legacy rows without meter columns treat `total_water_pumped` as cumulative.
    """
    if record.meter_reading_end is not None:
        end_val = float(record.meter_reading_end)
        if record.meter_reading_start is not None:
            delta = end_val - float(record.meter_reading_start)
            return (delta if delta > 0 else None), end_val
        if previous_end is not None:
            delta = end_val - previous_end
            return (delta if delta > 0 else None), end_val
        if record.total_water_pumped is not None:
            return float(record.total_water_pumped), end_val
        return None, end_val

    cumulative = record.total_water_pumped
    if cumulative is None:
        return None, previous_end
    cumulative = float(cumulative)
    if previous_end is None:
        return None, cumulative
    delta = cumulative - previous_end
    return (delta if delta > 0 else None), cumulative


def compute_interval_volumes(
    logs: Iterable[WaterEnergyLoggingDaily],
) -> dict[str, float]:
    """Map log id → effective interval m³ (chronological delta per system)."""
    volumes: dict[str, float] = {}
    prev_end: float | None = None
    for record in sort_water_logs(logs):
        vol, prev_end = interval_volume_from_log(record, prev_end)
        if vol is not None:
            volumes[str(record.id)] = vol
    return volumes


def sum_effective_pumped_m3(logs: Iterable[WaterEnergyLoggingDaily]) -> float:
    return sum(compute_interval_volumes(logs).values())


def get_previous_meter_reading_end(
    water_system_id: str,
    *,
    before_log_date: date,
    before_pump_end_time: time,
    exclude_record_id: str | None = None,
) -> float | None:
    """Most recent bulk-meter stop reading strictly before the given log moment."""
    end_t = before_pump_end_time or time.min
    q = WaterEnergyLoggingDaily.query.filter(
        WaterEnergyLoggingDaily.water_system_id == water_system_id,
        _log_for_meter_chain(),
        or_(
            WaterEnergyLoggingDaily.log_date < before_log_date,
            and_(
                WaterEnergyLoggingDaily.log_date == before_log_date,
                WaterEnergyLoggingDaily.pump_end_time < end_t,
            ),
        ),
    )
    if exclude_record_id:
        q = q.filter(WaterEnergyLoggingDaily.id != exclude_record_id)

    candidates = sort_water_logs(q.all())
    if not candidates:
        return None
    return _reading_end_value(candidates[-1])


def get_latest_submitted_meter_reading_end(
    water_system_id: str,
    *,
    exclude_record_id: str | None = None,
) -> float | None:
    """
    Highest ``meter_reading_end`` on submitted logs for this water system.

    Used for operator validation: the new pump-stop reading must exceed this
    cumulative bulk-meter value. Ignores ``total_water_pumped`` (interval volume).
    """
    q = WaterEnergyLoggingDaily.query.filter(
        WaterEnergyLoggingDaily.water_system_id == water_system_id,
        _log_for_meter_chain(),
        WaterEnergyLoggingDaily.meter_reading_end.isnot(None),
    )
    if exclude_record_id:
        q = q.filter(WaterEnergyLoggingDaily.id != exclude_record_id)

    values: list[float] = []
    for row in q.all():
        if row.meter_reading_end is None:
            continue
        values.append(float(row.meter_reading_end))
    return max(values) if values else None


def count_meter_chain_logs(
    water_system_id: str,
    *,
    exclude_record_id: str | None = None,
) -> int:
    """Count submitted meter-chain logs on a system (excludes drafts and rejected)."""
    q = WaterEnergyLoggingDaily.query.filter(
        WaterEnergyLoggingDaily.water_system_id == water_system_id,
        _log_for_meter_chain(),
    )
    if exclude_record_id:
        q = q.filter(WaterEnergyLoggingDaily.id != exclude_record_id)
    return q.count()


def resolve_bulk_meter_volumes(
    *,
    water_system_id: str,
    log_date: date,
    pump_end_time: time,
    meter_reading_end: float | None,
    meter_reading_start: float | None = None,
    legacy_total_water_pumped: float | None = None,
    exclude_record_id: str | None = None,
) -> dict[str, float]:
    """
    Compute stored meter fields from cumulative readings entered by the operator.

    First log on a system: requires initial + stop readings.
    Later logs: only stop reading; interval = stop − previous stop.
    """
    end_reading = meter_reading_end
    if end_reading is None and legacy_total_water_pumped is not None:
        end_reading = legacy_total_water_pumped

    if end_reading is None:
        raise ValueError(
            "meter_reading_end is required (cumulative bulk-meter reading at pump stop)"
        )

    prev_end = get_latest_submitted_meter_reading_end(
        water_system_id,
        exclude_record_id=exclude_record_id,
    )

    if prev_end is None:
        if meter_reading_start is None:
            raise ValueError(
                "meter_reading_start is required for the first bulk-meter log on this system"
            )
        base = float(meter_reading_start)
        stored_start = base
    else:
        base = float(prev_end)
        stored_start = float(meter_reading_start) if meter_reading_start is not None else base

    end_val = float(end_reading)
    if end_val <= base:
        raise MeterReadingOrderError(end_val, base)

    delta = end_val - base
    return {
        "meter_reading_start": stored_start,
        "meter_reading_end": end_val,
        "total_water_pumped": delta,
    }


def aggregate_monthly_effective_volumes(
    logs: Iterable[WaterEnergyLoggingDaily],
) -> dict[tuple[int, int], float]:
    """Sum effective interval m³ by (year, month) per-system chronological deltas."""
    by_system: dict[str, list[WaterEnergyLoggingDaily]] = {}
    for log in logs:
        by_system.setdefault(str(log.water_system_id), []).append(log)

    monthly: dict[tuple[int, int], float] = {}
    for system_logs in by_system.values():
        volumes = compute_interval_volumes(system_logs)
        for log in system_logs:
            vol = volumes.get(str(log.id))
            if vol is not None and log.log_date:
                key = (log.log_date.year, log.log_date.month)
                monthly[key] = monthly.get(key, 0.0) + vol
    return monthly


def _log_in_date_range(
    log: WaterEnergyLoggingDaily,
    *,
    start_date: date | None,
    end_date_exclusive: date | None,
) -> bool:
    if not log.log_date:
        return False
    if start_date and log.log_date < start_date:
        return False
    if end_date_exclusive and log.log_date >= end_date_exclusive:
        return False
    return True


def aggregate_system_effective_volumes_in_range(
    logs: Iterable[WaterEnergyLoggingDaily],
    *,
    start_date: date | None = None,
    end_date_exclusive: date | None = None,
) -> dict[str, float]:
    """Per-system sum of interval m³ for logs inside [start_date, end_date_exclusive)."""
    by_system: dict[str, list[WaterEnergyLoggingDaily]] = {}
    for log in logs:
        by_system.setdefault(str(log.water_system_id), []).append(log)

    totals: dict[str, float] = {}
    for sid, system_logs in by_system.items():
        volumes = compute_interval_volumes(system_logs)
        total = 0.0
        for log in system_logs:
            if not _log_in_date_range(
                log, start_date=start_date, end_date_exclusive=end_date_exclusive
            ):
                continue
            vol = volumes.get(str(log.id))
            if vol is not None:
                total += vol
        totals[sid] = total
    return totals


def aggregate_system_meter_snapshots_in_range(
    logs: Iterable[WaterEnergyLoggingDaily],
    *,
    start_date: date | None = None,
    end_date_exclusive: date | None = None,
) -> dict[str, dict[str, float | None]]:
    """
    Per-system cumulative meter snapshot for logs in range.

    Returns ``latest_meter_reading_end`` (cumulative stop reading on the most
    recent log) and ``period_meter_net_m3`` (latest end − earliest start in range).
    """
    by_system: dict[str, list[WaterEnergyLoggingDaily]] = {}
    for log in logs:
        by_system.setdefault(str(log.water_system_id), []).append(log)

    snapshots: dict[str, dict[str, float | None]] = {}
    for sid, system_logs in by_system.items():
        in_range = [
            log
            for log in sort_water_logs(system_logs)
            if _log_in_date_range(
                log, start_date=start_date, end_date_exclusive=end_date_exclusive
            )
        ]
        if not in_range:
            snapshots[sid] = {
                "latest_meter_reading_end": None,
                "period_meter_net_m3": None,
            }
            continue

        first_log = in_range[0]
        last_log = in_range[-1]
        latest_end = _reading_end_value(last_log)

        if first_log.meter_reading_start is not None:
            first_baseline = float(first_log.meter_reading_start)
        elif first_log.meter_reading_end is not None:
            first_baseline = float(first_log.meter_reading_end)
        else:
            first_baseline = None

        period_net: float | None = None
        if (
            latest_end is not None
            and first_baseline is not None
            and latest_end > first_baseline
        ):
            period_net = latest_end - first_baseline

        snapshots[sid] = {
            "latest_meter_reading_end": latest_end,
            "period_meter_net_m3": period_net,
        }
    return snapshots


def apply_bulk_meter_fields(
    record: WaterEnergyLoggingDaily,
    *,
    water_system_id: str,
    no_bulk_meter_installed: bool,
    meter_reading_end: float | None,
    meter_reading_start: float | None,
    legacy_total_water_pumped: float | None,
    exclude_record_id: str | None = None,
) -> None:
    if no_bulk_meter_installed:
        record.meter_reading_start = None
        record.meter_reading_end = None
        record.total_water_pumped = None
        return

    if record.log_date is None or record.pump_end_time is None:
        raise ValueError("log_date and pump_end_time are required to compute meter volume")

    resolved = resolve_bulk_meter_volumes(
        water_system_id=water_system_id,
        log_date=record.log_date,
        pump_end_time=record.pump_end_time,
        meter_reading_end=meter_reading_end,
        meter_reading_start=meter_reading_start,
        legacy_total_water_pumped=legacy_total_water_pumped,
        exclude_record_id=exclude_record_id,
    )
    record.meter_reading_start = resolved["meter_reading_start"]
    record.meter_reading_end = resolved["meter_reading_end"]
    record.total_water_pumped = resolved["total_water_pumped"]

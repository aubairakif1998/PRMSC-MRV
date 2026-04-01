"""Pump start/end times of day and derived operating hours for water daily logs."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any


def parse_time_of_day(value: Any) -> time | None:
    """Parse user input into a time-of-day (no timezone). Accepts time, or strings like HH:MM, HH:MM:SS, or ISO datetime."""
    if value is None:
        return None
    if isinstance(value, time):
        return value
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        for fmt in ("%H:%M:%S", "%H:%M"):
            try:
                return datetime.strptime(s, fmt).time()
            except ValueError:
                continue
        try:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            t = dt.time()
            if t.tzinfo is not None:
                t = t.replace(tzinfo=None)
            return t
        except ValueError:
            return None
    return None


def pump_hours_from_start_end(start: time, end: time) -> float:
    """
    Duration in hours for one pumping interval on log_date.
    If end is not after start on the same clock day, end is treated as the next calendar day (overnight run).
    """
    base = date(2000, 1, 1)
    dt_start = datetime.combine(base, start)
    dt_end = datetime.combine(base, end)
    if dt_end <= dt_start:
        dt_end += timedelta(days=1)
    return (dt_end - dt_start).total_seconds() / 3600.0


def time_to_json(t: time | None) -> str | None:
    if t is None:
        return None
    return t.isoformat(timespec="seconds")


def apply_pump_time_fields_from_payload(record: Any, data: dict) -> None:
    """
    Set pump_start_time / pump_end_time from dict keys when present.
    When both times are set, overwrites pump_operating_hours with the derived value.
    Otherwise, if pump_operating_hours is in the payload, sets it (legacy / manual).
    """
    if "pump_start_time" in data:
        record.pump_start_time = parse_time_of_day(data.get("pump_start_time"))
    if "pump_end_time" in data:
        record.pump_end_time = parse_time_of_day(data.get("pump_end_time"))
    if record.pump_start_time is not None and record.pump_end_time is not None:
        record.pump_operating_hours = pump_hours_from_start_end(
            record.pump_start_time, record.pump_end_time
        )
    elif "pump_operating_hours" in data:
        record.pump_operating_hours = data.get("pump_operating_hours")

"""Unit tests for bulk-meter reading validation."""

from __future__ import annotations

import unittest
from datetime import date, time
from types import SimpleNamespace
from unittest.mock import patch

from app.utils.water_meter_volume import (
    MeterReadingOrderError,
    interval_volume_from_log,
    resolve_bulk_meter_volumes,
)


def _log(
    *,
    meter_reading_end=None,
    meter_reading_start=None,
    total_water_pumped=None,
    status="submitted",
    log_date=None,
    pump_end_time=None,
):
    return SimpleNamespace(
        id="log-1",
        meter_reading_end=meter_reading_end,
        meter_reading_start=meter_reading_start,
        total_water_pumped=total_water_pumped,
        status=status,
        log_date=log_date or date(2025, 6, 1),
        pump_start_time=time(8, 0),
        pump_end_time=pump_end_time or time(12, 0),
        created_at=None,
        water_system_id="ws-1",
    )


class IntervalVolumeTests(unittest.TestCase):
    def test_interval_from_meter_start_and_end(self):
        log = _log(meter_reading_start=100.0, meter_reading_end=150.0)
        vol, new_end = interval_volume_from_log(log, None)
        self.assertEqual(vol, 50.0)
        self.assertEqual(new_end, 150.0)

    def test_interval_from_previous_end(self):
        log = _log(meter_reading_end=200.0)
        vol, new_end = interval_volume_from_log(log, 150.0)
        self.assertEqual(vol, 50.0)
        self.assertEqual(new_end, 200.0)


class ResolveBulkMeterVolumesTests(unittest.TestCase):
    @patch(
        "app.utils.water_meter_volume.get_latest_submitted_meter_reading_end",
        return_value=None,
    )
    def test_first_log_requires_start_reading(self, _mock_latest):
        with self.assertRaises(ValueError):
            resolve_bulk_meter_volumes(
                water_system_id="ws-1",
                log_date=date(2025, 6, 1),
                pump_end_time=time(12, 0),
                meter_reading_end=100.0,
                meter_reading_start=None,
            )

    @patch(
        "app.utils.water_meter_volume.get_latest_submitted_meter_reading_end",
        return_value=None,
    )
    def test_first_log_computes_delta_from_start(self, _mock_latest):
        result = resolve_bulk_meter_volumes(
            water_system_id="ws-1",
            log_date=date(2025, 6, 1),
            pump_end_time=time(12, 0),
            meter_reading_end=150.0,
            meter_reading_start=100.0,
        )
        self.assertEqual(result["meter_reading_start"], 100.0)
        self.assertEqual(result["meter_reading_end"], 150.0)
        self.assertEqual(result["total_water_pumped"], 50.0)

    @patch(
        "app.utils.water_meter_volume.get_latest_submitted_meter_reading_end",
        return_value=57082.0,
    )
    def test_later_log_must_exceed_latest_submitted_end(self, _mock_latest):
        with self.assertRaises(MeterReadingOrderError) as ctx:
            resolve_bulk_meter_volumes(
                water_system_id="ws-1",
                log_date=date(2025, 6, 2),
                pump_end_time=time(12, 0),
                meter_reading_end=57082.0,
            )
        self.assertEqual(ctx.exception.code, "meter_reading_order")
        self.assertEqual(ctx.exception.base_val, 57082.0)

    @patch(
        "app.utils.water_meter_volume.get_latest_submitted_meter_reading_end",
        return_value=57082.0,
    )
    def test_later_log_accepts_higher_end_reading(self, _mock_latest):
        result = resolve_bulk_meter_volumes(
            water_system_id="ws-1",
            log_date=date(2025, 6, 2),
            pump_end_time=time(12, 0),
            meter_reading_end=57100.0,
        )
        self.assertEqual(result["meter_reading_start"], 57082.0)
        self.assertEqual(result["meter_reading_end"], 57100.0)
        self.assertEqual(result["total_water_pumped"], 18.0)


if __name__ == "__main__":
    unittest.main()

from flask import Blueprint, request, jsonify
from datetime import date
from app.extensions import db
from app.models.models import (
    WaterSystem,
    WaterEnergyLoggingDaily,
    SolarSystem,
    SystemMeter,
    SolarEnergyLoggingMonthly,
    SUBMISSION_STATUS_REJECTED,
    METER_TYPE_TUBEWELL,
)
from sqlalchemy import extract, func, or_

from app.utils.water_meter_volume import (
    aggregate_monthly_effective_volumes,
    aggregate_system_effective_volumes_in_range,
    aggregate_system_meter_snapshots_in_range,
)

dashboard_bp = Blueprint('dashboard', __name__)


def _log_not_rejected():
    """SQL-safe: include NULL status (legacy rows) and every status except rejected."""
    return or_(
        WaterEnergyLoggingDaily.status.is_(None),
        WaterEnergyLoggingDaily.status != SUBMISSION_STATUS_REJECTED,
    )


def _apply_location_filters(query, tehsil, village, *, model):
    if tehsil and tehsil != "All Tehsils":
        query = query.filter(model.tehsil == tehsil)
    if village and village != "All Villages":
        query = query.filter(model.village == village)
    return query


def _apply_log_date_filters(query, month, year):
    """Apply index-friendly date range filters instead of extract() predicates."""
    if year and month:
        start = date(year, month, 1)
        end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
        return query.filter(
            WaterEnergyLoggingDaily.log_date >= start,
            WaterEnergyLoggingDaily.log_date < end,
        )
    if year:
        return query.filter(
            WaterEnergyLoggingDaily.log_date >= date(year, 1, 1),
            WaterEnergyLoggingDaily.log_date < date(year + 1, 1, 1),
        )
    if month:
        return query.filter(extract("month", WaterEnergyLoggingDaily.log_date) == month)
    return query


@dashboard_bp.route('/program-summary', methods=['GET'])
def get_program_summary():
    tehsil = request.args.get('tehsil')
    village = request.args.get('village')
    
    ws_query = _apply_location_filters(
        db.session.query(func.count(WaterSystem.id)),
        tehsil,
        village,
        model=WaterSystem,
    )
    ss_query = _apply_location_filters(
        db.session.query(func.count(SolarSystem.id)),
        tehsil,
        village,
        model=SolarSystem,
    )

    ohr_count = ws_query.scalar() or 0
    solar_facilities = ss_query.scalar() or 0

    bulk_meters = (
        db.session.query(func.count(SystemMeter.id))
        .join(WaterSystem, WaterSystem.id == SystemMeter.water_system_id)
        .filter(
            SystemMeter.meter_type == METER_TYPE_TUBEWELL,
            SystemMeter.is_active.is_(True),
        )
    )
    bulk_meters = _apply_location_filters(
        bulk_meters, tehsil, village, model=WaterSystem
    )
    bulk_meters = bulk_meters.scalar() or 0
    
    return jsonify({
        "ohr_count": ohr_count,
        "solar_facilities": solar_facilities,
        "bulk_meters": bulk_meters
    }), 200

@dashboard_bp.route('/water-supplied', methods=['GET'])
def get_water_supplied():
    """Monthly m³: sum of interval volumes from bulk-meter deltas per calendar month."""
    tehsil = request.args.get('tehsil')
    village = request.args.get('village')
    month = request.args.get('month', type=int)
    year = request.args.get('year', type=int)

    logs_query = WaterEnergyLoggingDaily.query.filter(_log_not_rejected())
    if (tehsil and tehsil != "All Tehsils") or (village and village != "All Villages"):
        logs_query = logs_query.join(
            WaterSystem, WaterEnergyLoggingDaily.water_system_id == WaterSystem.id
        )
        logs_query = _apply_location_filters(logs_query, tehsil, village, model=WaterSystem)

    fetch_end_exclusive = None
    if year and month:
        fetch_end_exclusive = (
            date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
        )
    elif year:
        fetch_end_exclusive = date(year + 1, 1, 1)

    if fetch_end_exclusive is not None:
        logs_query = logs_query.filter(
            WaterEnergyLoggingDaily.log_date < fetch_end_exclusive
        )

    monthly_totals = aggregate_monthly_effective_volumes(logs_query.all())

    if year and month:
        return jsonify(
            [{"month": month, "total_water_pumped": monthly_totals.get((year, month), 0)}]
        ), 200

    if year:
        data = [
            {"month": m, "total_water_pumped": monthly_totals.get((year, m), 0)}
            for m in range(1, 13)
        ]
        return jsonify(data), 200

    if month:
        total = sum(v for (y, m), v in monthly_totals.items() if m == month)
        return jsonify([{"month": month, "total_water_pumped": total}]), 200

    by_month: dict[int, float] = {}
    for (_y, m), v in monthly_totals.items():
        by_month[m] = by_month.get(m, 0.0) + v
    data = [{"month": m, "total_water_pumped": by_month.get(m, 0)} for m in range(1, 13)]
    return jsonify(data), 200

@dashboard_bp.route('/pump-hours', methods=['GET'])
def get_pump_hours():
    """Monthly pump run time: sum of daily `pump_operating_hours` for all water systems.

    Same rows may also contribute to `/water-supplied` (m³) when both volume and hours are
    logged — e.g. flow-metered sites can still record pump time. Not filtered by bulk meter
    on the system record. Rejected logs excluded.
    """
    tehsil = request.args.get('tehsil')
    village = request.args.get('village')
    month = request.args.get('month', type=int)
    year = request.args.get('year', type=int)
    
    w_m = extract("month", WaterEnergyLoggingDaily.log_date)
    query = (
        db.session.query(
            w_m.label("month"),
            func.sum(
                func.coalesce(WaterEnergyLoggingDaily.pump_operating_hours, 0.0)
            ).label("total"),
        )
        .filter(_log_not_rejected())
    )

    if (tehsil and tehsil != "All Tehsils") or (village and village != "All Villages"):
        query = query.join(WaterSystem, WaterEnergyLoggingDaily.water_system_id == WaterSystem.id)
        query = _apply_location_filters(query, tehsil, village, model=WaterSystem)
    query = _apply_log_date_filters(query, month, year)

    query = query.group_by(w_m).order_by(w_m)
    results = query.all()

    data_dict = {int(r.month): float(r.total or 0) for r in results}
    data = [{"month": m, "pump_operating_hours": data_dict.get(m, 0)} for m in range(1, 13)]
    
    return jsonify(data), 200

@dashboard_bp.route('/solar-generation', methods=['GET'])
def get_solar_generation():
    tehsil = request.args.get('tehsil')
    village = request.args.get('village')
    month = request.args.get('month', type=int)
    year = request.args.get('year', type=int)
    
    # Solar "generation" in the dashboard corresponds to energy exported to grid.
    # Model stores export split into peak/off-peak; sum both (NULL-safe).
    exported_kwh = (
        func.coalesce(SolarEnergyLoggingMonthly.export_off_peak, 0.0)
        + func.coalesce(SolarEnergyLoggingMonthly.export_peak, 0.0)
    )
    query = db.session.query(
        SolarEnergyLoggingMonthly.month,
        func.sum(exported_kwh).label("total"),
    )

    if (tehsil and tehsil != "All Tehsils") or (village and village != "All Villages"):
        query = query.join(SolarSystem, SolarEnergyLoggingMonthly.solar_system_id == SolarSystem.id)
        query = _apply_location_filters(query, tehsil, village, model=SolarSystem)
    if month:
        query = query.filter(SolarEnergyLoggingMonthly.month == month)
    if year:
        query = query.filter(SolarEnergyLoggingMonthly.year == year)

    query = query.group_by(SolarEnergyLoggingMonthly.month).order_by(
        SolarEnergyLoggingMonthly.month
    )
    results = query.all()
    
    data_dict = {r.month: float(r.total or 0) for r in results}
    data = [{"month": m, "solar_generation_kwh": data_dict.get(m, 0)} for m in range(1, 13)]
    
    return jsonify(data), 200

@dashboard_bp.route('/grid-import', methods=['GET'])
def get_grid_import():
    tehsil = request.args.get('tehsil')
    village = request.args.get('village')
    month = request.args.get('month', type=int)
    year = request.args.get('year', type=int)
    
    # Grid import is stored as import split into peak/off-peak; sum both (NULL-safe).
    imported_kwh = (
        func.coalesce(SolarEnergyLoggingMonthly.import_off_peak, 0.0)
        + func.coalesce(SolarEnergyLoggingMonthly.import_peak, 0.0)
    )
    query = db.session.query(
        SolarEnergyLoggingMonthly.month,
        func.sum(imported_kwh).label("total"),
    )

    if (tehsil and tehsil != "All Tehsils") or (village and village != "All Villages"):
        query = query.join(SolarSystem, SolarEnergyLoggingMonthly.solar_system_id == SolarSystem.id)
        query = _apply_location_filters(query, tehsil, village, model=SolarSystem)
    if month:
        query = query.filter(SolarEnergyLoggingMonthly.month == month)
    if year:
        query = query.filter(SolarEnergyLoggingMonthly.year == year)

    query = query.group_by(SolarEnergyLoggingMonthly.month).order_by(
        SolarEnergyLoggingMonthly.month
    )
    results = query.all()
    
    data_dict = {r.month: float(r.total or 0) for r in results}
    data = [{"month": m, "grid_import_kwh": data_dict.get(m, 0)} for m in range(1, 13)]
    
    return jsonify(data), 200


@dashboard_bp.route("/water-systems-detail", methods=["GET"])
def get_water_systems_detail():
    """
    Per-water-system analysis for executive drill-down.

    Aggregates interval m³ from bulk-meter reading deltas (chronological per system).
    """
    tehsil = request.args.get("tehsil")
    village = request.args.get("village")
    month = request.args.get("month", type=int)
    year = request.args.get("year", type=int)

    range_start = None
    range_end_exclusive = None
    fetch_end_exclusive = None
    if year and month:
        range_start = date(year, month, 1)
        range_end_exclusive = (
            date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
        )
        fetch_end_exclusive = range_end_exclusive
    elif year:
        range_start = date(year, 1, 1)
        range_end_exclusive = date(year + 1, 1, 1)
        fetch_end_exclusive = range_end_exclusive

    systems_query = WaterSystem.query
    systems_query = _apply_location_filters(systems_query, tehsil, village, model=WaterSystem)
    systems = systems_query.order_by(
        WaterSystem.tehsil, WaterSystem.village, WaterSystem.unique_identifier
    ).all()
    if not systems:
        return jsonify({"rows": [], "meta": {"month": month, "year": year}}), 200

    system_ids = [s.id for s in systems]
    logs_query = WaterEnergyLoggingDaily.query.filter(
        WaterEnergyLoggingDaily.water_system_id.in_(system_ids),
        _log_not_rejected(),
    )
    if fetch_end_exclusive is not None:
        logs_query = logs_query.filter(
            WaterEnergyLoggingDaily.log_date < fetch_end_exclusive
        )
    all_logs = logs_query.all()

    water_by_system = aggregate_system_effective_volumes_in_range(
        all_logs,
        start_date=range_start,
        end_date_exclusive=range_end_exclusive,
    )
    meter_by_system = aggregate_system_meter_snapshots_in_range(
        all_logs,
        start_date=range_start,
        end_date_exclusive=range_end_exclusive,
    )

    hours_q = (
        db.session.query(
            WaterEnergyLoggingDaily.water_system_id.label("water_system_id"),
            func.sum(func.coalesce(WaterEnergyLoggingDaily.pump_operating_hours, 0.0)).label(
                "total_pump_hours"
            ),
            func.count(func.distinct(WaterEnergyLoggingDaily.log_date)).label("days_logged"),
            func.count(WaterEnergyLoggingDaily.id).label("logs_count"),
        )
        .filter(
            WaterEnergyLoggingDaily.water_system_id.in_(system_ids),
            _log_not_rejected(),
        )
    )
    if range_start:
        hours_q = hours_q.filter(WaterEnergyLoggingDaily.log_date >= range_start)
    if range_end_exclusive:
        hours_q = hours_q.filter(WaterEnergyLoggingDaily.log_date < range_end_exclusive)
    hours_q = hours_q.group_by(WaterEnergyLoggingDaily.water_system_id)
    hours_by_system = {str(r.water_system_id): r for r in hours_q.all()}

    rows = []
    for system in systems:
        sid = str(system.id)
        water = float(water_by_system.get(sid, 0))
        meter = meter_by_system.get(sid, {})
        latest_meter = meter.get("latest_meter_reading_end")
        period_net = meter.get("period_meter_net_m3")
        stats = hours_by_system.get(sid)
        hours = float(stats.total_pump_hours or 0) if stats else 0.0
        d_logged = int(stats.days_logged or 0) if stats else 0
        l_count = int(stats.logs_count or 0) if stats else 0
        if l_count == 0:
            continue
        rows.append(
            {
                "water_system_id": system.id,
                "unique_identifier": system.unique_identifier,
                "tehsil": system.tehsil,
                "village": system.village,
                "settlement": system.settlement,
                "bulk_meter_installed": bool(system.bulk_meter_installed),
                "total_water_pumped_m3": water,
                "latest_meter_reading_end_m3": (
                    float(latest_meter) if latest_meter is not None else None
                ),
                "period_meter_net_m3": (
                    float(period_net) if period_net is not None else None
                ),
                "total_pump_hours_h": hours,
                "days_logged": d_logged,
                "logs_count": l_count,
                "avg_m3_per_hour": (water / hours) if hours > 0 else None,
                "avg_m3_per_day_logged": (water / d_logged) if d_logged > 0 else None,
                "avg_hours_per_day_logged": (hours / d_logged) if d_logged > 0 else None,
            }
        )
    return jsonify({"rows": rows, "meta": {"month": month, "year": year}}), 200


@dashboard_bp.route("/solar-systems-detail", methods=["GET"])
def get_solar_systems_detail():
    """
    Per-solar-system analysis for executive drill-down.

    Uses `SolarEnergyLoggingMonthly` (monthly site records) and aggregates by system.
    """
    tehsil = request.args.get("tehsil")
    village = request.args.get("village")
    month = request.args.get("month", type=int)
    year = request.args.get("year", type=int)

    exported_kwh = (
        func.coalesce(SolarEnergyLoggingMonthly.export_off_peak, 0.0)
        + func.coalesce(SolarEnergyLoggingMonthly.export_peak, 0.0)
    )
    imported_kwh = (
        func.coalesce(SolarEnergyLoggingMonthly.import_off_peak, 0.0)
        + func.coalesce(SolarEnergyLoggingMonthly.import_peak, 0.0)
    )
    net_kwh = (
        func.coalesce(SolarEnergyLoggingMonthly.net_off_peak, 0.0)
        + func.coalesce(SolarEnergyLoggingMonthly.net_peak, 0.0)
    )

    months_logged = func.count(func.distinct(SolarEnergyLoggingMonthly.month)).label("months_logged")
    records_count = func.count(SolarEnergyLoggingMonthly.id).label("records_count")

    query = (
        db.session.query(
            SolarSystem.id.label("solar_system_id"),
            SolarSystem.unique_identifier.label("unique_identifier"),
            SolarSystem.tehsil.label("tehsil"),
            SolarSystem.village.label("village"),
            SolarSystem.settlement.label("settlement"),
            SolarSystem.disco_info.label("disco_info"),
            SolarSystem.bill_reference_number.label("bill_reference_number"),
            func.sum(exported_kwh).label("total_export_kwh"),
            func.sum(imported_kwh).label("total_import_kwh"),
            func.sum(net_kwh).label("total_net_kwh"),
            months_logged,
            records_count,
        )
        .join(SolarEnergyLoggingMonthly, SolarEnergyLoggingMonthly.solar_system_id == SolarSystem.id)
    )

    query = _apply_location_filters(query, tehsil, village, model=SolarSystem)
    if month:
        query = query.filter(SolarEnergyLoggingMonthly.month == month)
    if year:
        query = query.filter(SolarEnergyLoggingMonthly.year == year)

    query = query.group_by(
        SolarSystem.id,
        SolarSystem.unique_identifier,
        SolarSystem.tehsil,
        SolarSystem.village,
        SolarSystem.settlement,
        SolarSystem.disco_info,
        SolarSystem.bill_reference_number,
    ).order_by(SolarSystem.tehsil, SolarSystem.village, SolarSystem.unique_identifier)

    rows = []
    for r in query.all():
        exp_kwh = float(r.total_export_kwh or 0)
        imp_kwh = float(r.total_import_kwh or 0)
        net_total = float(r.total_net_kwh or 0)
        m_logged = int(r.months_logged or 0)
        recs = int(r.records_count or 0)
        rows.append(
            {
                "solar_system_id": r.solar_system_id,
                "unique_identifier": r.unique_identifier,
                "tehsil": r.tehsil,
                "village": r.village,
                "settlement": r.settlement,
                "disco_info": r.disco_info,
                "bill_reference_number": r.bill_reference_number,
                "total_export_kwh": exp_kwh,
                "total_import_kwh": imp_kwh,
                "total_net_kwh": net_total,
                "months_logged": m_logged,
                "records_count": recs,
                "avg_export_kwh_per_month": (exp_kwh / m_logged) if m_logged > 0 else None,
                "avg_import_kwh_per_month": (imp_kwh / m_logged) if m_logged > 0 else None,
                "avg_net_kwh_per_month": (net_total / m_logged) if m_logged > 0 else None,
            }
        )

    return jsonify({"rows": rows, "meta": {"month": month, "year": year}}), 200

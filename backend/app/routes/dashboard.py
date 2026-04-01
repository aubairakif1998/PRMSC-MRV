from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.models import (
    WaterSystem,
    WaterEnergyLoggingDaily,
    SolarSystem,
    SolarEnergyLoggingMonthly,
)
from sqlalchemy import extract, func

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/program-summary', methods=['GET'])
def get_program_summary():
    tehsil = request.args.get('tehsil')
    village = request.args.get('village')
    
    ws_query = WaterSystem.query
    ss_query = SolarSystem.query
    
    if tehsil and tehsil != 'All Tehsils':
        ws_query = ws_query.filter_by(tehsil=tehsil)
        ss_query = ss_query.filter_by(tehsil=tehsil)
    
    if village and village != 'All Villages':
        ws_query = ws_query.filter_by(village=village)
        ss_query = ss_query.filter_by(village=village)
        
    ohr_count = ws_query.count()
    solar_facilities = ss_query.count()
    
    # Count systems where bulk flow meter is installed
    # In our schema, meter_serial_number being present means a bulk meter is installed
    bulk_meters = ws_query.filter(
        WaterSystem.meter_serial_number != None,
        WaterSystem.meter_serial_number != ''
    ).count()
    
    return jsonify({
        "ohr_count": ohr_count,
        "solar_facilities": solar_facilities,
        "bulk_meters": bulk_meters
    }), 200

@dashboard_bp.route('/water-supplied', methods=['GET'])
def get_water_supplied():
    tehsil = request.args.get('tehsil')
    village = request.args.get('village')
    month = request.args.get('month', type=int)
    year = request.args.get('year', type=int)
    
    w_m = extract("month", WaterEnergyLoggingDaily.log_date)
    w_y = extract("year", WaterEnergyLoggingDaily.log_date)
    query = (
        db.session.query(
            w_m.label("month"),
            func.sum(WaterEnergyLoggingDaily.total_water_pumped).label("total"),
        )
        .join(WaterSystem, WaterEnergyLoggingDaily.water_system_id == WaterSystem.id)
        .filter(
            WaterSystem.meter_serial_number != None,
            WaterSystem.meter_serial_number != "",
        )
    )

    if tehsil and tehsil != "All Tehsils":
        query = query.filter(WaterSystem.tehsil == tehsil)
    if village and village != "All Villages":
        query = query.filter(WaterSystem.village == village)
    if month:
        query = query.filter(w_m == month)
    if year:
        query = query.filter(w_y == year)

    query = query.group_by(w_m).order_by(w_m)
    results = query.all()

    data_dict = {int(r.month): float(r.total or 0) for r in results}
    data = [{"month": m, "total_water_pumped": data_dict.get(m, 0)} for m in range(1, 13)]

    return jsonify(data), 200

@dashboard_bp.route('/pump-hours', methods=['GET'])
def get_pump_hours():
    tehsil = request.args.get('tehsil')
    village = request.args.get('village')
    month = request.args.get('month', type=int)
    year = request.args.get('year', type=int)
    
    w_m = extract("month", WaterEnergyLoggingDaily.log_date)
    w_y = extract("year", WaterEnergyLoggingDaily.log_date)
    query = (
        db.session.query(
            w_m.label("month"),
            func.sum(WaterEnergyLoggingDaily.pump_operating_hours).label("total"),
        )
        .join(WaterSystem, WaterEnergyLoggingDaily.water_system_id == WaterSystem.id)
        .filter(
            (WaterSystem.meter_serial_number == None)
            | (WaterSystem.meter_serial_number == "")
        )
    )

    if tehsil and tehsil != "All Tehsils":
        query = query.filter(WaterSystem.tehsil == tehsil)
    if village and village != "All Villages":
        query = query.filter(WaterSystem.village == village)
    if month:
        query = query.filter(w_m == month)
    if year:
        query = query.filter(w_y == year)

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
    
    query = db.session.query(
        SolarEnergyLoggingMonthly.month,
        func.sum(SolarEnergyLoggingMonthly.energy_exported_to_grid).label("total"),
    ).join(SolarSystem, SolarEnergyLoggingMonthly.solar_system_id == SolarSystem.id)

    if tehsil and tehsil != "All Tehsils":
        query = query.filter(SolarSystem.tehsil == tehsil)
    if village and village != "All Villages":
        query = query.filter(SolarSystem.village == village)
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
    
    query = db.session.query(
        SolarEnergyLoggingMonthly.month,
        func.sum(SolarEnergyLoggingMonthly.energy_consumed_from_grid).label("total"),
    ).join(SolarSystem, SolarEnergyLoggingMonthly.solar_system_id == SolarSystem.id)

    if tehsil and tehsil != "All Tehsils":
        query = query.filter(SolarSystem.tehsil == tehsil)
    if village and village != "All Villages":
        query = query.filter(SolarSystem.village == village)
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

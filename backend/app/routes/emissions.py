"""
Emission Routes Blueprint
=========================
All API endpoints related to emission calculations and analytics.

Why a separate blueprint?
  - Keeps emission logic isolated from operator routes and analyst routes.
  - A frontend developer can find all emission APIs in one place.
  - Easy to version later (e.g., /api/v2/emissions/...).

Available Endpoints:
  POST /api/emissions/calculate        → Trigger calculation for a system/year
  GET  /api/emissions/summary          → Total reductions across all systems
  GET  /api/emissions/monthly-trend    → Month-by-month reduction data for charts
  GET  /api/emissions/system-comparison → Compare reduction across systems
  GET  /api/emissions/audit/<id>       → View full audit trail for one result
"""

from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.models import (
    WaterSystem, MonthlyWaterData,
    SolarSystem, MonthlyEnergyData,
    EmissionResult,
    SUBMISSION_STATUS_APPROVED
)
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.utils.decorators import role_required
from app.services.emission_service import (
    calculate_water_system_emissions,
    calculate_solar_system_emissions,
    build_audit_record,
    PAKISTAN_GRID_EF
)
from datetime import datetime

emissions_bp = Blueprint('emissions', __name__)


# ─────────────────────────────────────────────────────────────
# POST /api/emissions/calculate
# Trigger calculation for a specific system and year
# ─────────────────────────────────────────────────────────────

@emissions_bp.route('/calculate', methods=['POST'])
@jwt_required()
@role_required(['analyst', 'environment_manager', 'operator'])
def calculate_emissions():
    """
    Fetch operational data → run calculations → save to emission_results → return.

    Request body:
      { "system_id": "uuid", "system_type": "water"|"solar", "year": 2024 }

    How this works step by step:
      1. Receive system_id and year from the frontend
      2. Fetch all monthly operational records for that system + year
      3. Pass records to EmissionService → returns calculated dict
      4. Save results to emission_results table (for dashboard performance)
      5. Return JSON results to frontend for display

    Why store results?
      Recalculating from raw data every time a dashboard loads is SLOW.
      Storing final results makes the dashboard load instantly.
      (Same reason Excel saves computed cell values — not just formulas)
    """
    data = request.get_json()
    system_id = data.get('system_id')
    system_type = data.get('system_type', 'water')
    year = data.get('year', datetime.now().year)

    if not system_id:
        return jsonify({"message": "system_id is required"}), 400

    if system_type == 'water':
        # Fetch monthly water records for this system and year
        # IMPORTANT: Only use APPROVED data for emission calculations
        records = MonthlyWaterData.query.filter_by(
            water_system_id=system_id
        ).filter_by(
            year=year
        ).filter_by(
            status=SUBMISSION_STATUS_APPROVED
        ).all()

        if not records:
            return jsonify({"message": f"No water data found for this system in {year}"}), 404

        # Get pump power rating from system info if available
        water_system = WaterSystem.query.get(system_id)
        pump_power = water_system.pump_flow_rate if water_system else None  # reuse field

        # Also fetch corresponding solar grid data if available
        solar_records = MonthlyEnergyData.query.filter_by(year=year).all()

        result = calculate_water_system_emissions(records, pump_power, solar_records)

    elif system_type == 'solar':
        # IMPORTANT: Only use APPROVED data for emission calculations
        records = MonthlyEnergyData.query.filter_by(
            solar_system_id=system_id,
            year=year,
            status=SUBMISSION_STATUS_APPROVED
        ).all()

        if not records:
            return jsonify({"message": f"No solar data found for this system in {year}"}), 404

        result = calculate_solar_system_emissions(records)

    else:
        return jsonify({"message": "system_type must be 'water' or 'solar'"}), 400

    # Build audit record
    current_user = get_jwt_identity()
    audit = build_audit_record(result, system_id, system_type, year, current_user)

    # Save to database (upsert: delete old result for same system+year, insert new)
    existing = EmissionResult.query.filter_by(
        system_id=system_id, system_type=system_type, year=year
    ).first()
    if existing:
        db.session.delete(existing)

    emission_rec = EmissionResult(
        system_type=system_type,
        system_id=system_id,
        year=year,
        baseline_emission=audit['baseline_emission'],
        project_emission=audit['project_emission'],
        emission_reduction=audit['emission_reduction'],
    )
    db.session.add(emission_rec)
    db.session.commit()

    return jsonify({
        "message": "Emission reduction calculated successfully",
        "system_id": system_id,
        "system_type": system_type,
        "year": year,
        "result": result,
        "audit": audit,
    }), 200


# ─────────────────────────────────────────────────────────────
# GET /api/emissions/summary
# Dashboard overview totals
# ─────────────────────────────────────────────────────────────

@emissions_bp.route('/summary', methods=['GET'])
@jwt_required()
@role_required(['analyst', 'environment_manager', 'operations_department', 'operator'])
def get_emissions_summary():
    """
    Returns aggregate totals for the emission dashboard.

    Response:
      {
        "total_reduction_kg": 245000.0,
        "total_reduction_tco2": 245.0,
        "water_reduction_tco2": 120.0,
        "solar_reduction_tco2": 125.0,
        "trees_equivalent": 12250,
        "systems_calculated": 8,
        "emission_factor": 0.45
      }

    How React updates charts:
      useEffect(() => {
        fetch('/api/emissions/summary') → setData(result) → chart re-renders
      }, []);
    """
    year = request.args.get('year', type=int)

    query = EmissionResult.query
    if year:
        query = query.filter_by(year=year)

    all_results = query.all()

    total_reduction_kg = sum(r.emission_reduction or 0 for r in all_results)
    water_reduction_kg = sum(r.emission_reduction or 0 for r in all_results if r.system_type == 'water')
    solar_reduction_kg = sum(r.emission_reduction or 0 for r in all_results if r.system_type == 'solar')

    trees_equivalent = int((total_reduction_kg / 1000) * 50)  # 1 tCO₂ ≈ 50 trees

    return jsonify({
        "total_reduction_kg": round(total_reduction_kg, 2),
        "total_reduction_tco2": round(total_reduction_kg / 1000, 3),
        "water_reduction_kg": round(water_reduction_kg, 2),
        "water_reduction_tco2": round(water_reduction_kg / 1000, 3),
        "solar_reduction_kg": round(solar_reduction_kg, 2),
        "solar_reduction_tco2": round(solar_reduction_kg / 1000, 3),
        "trees_equivalent": trees_equivalent,
        "systems_calculated": len(set(r.system_id for r in all_results)),
        "emission_factor_used": PAKISTAN_GRID_EF,
        "year_filter": year,
    }), 200


# ─────────────────────────────────────────────────────────────
# GET /api/emissions/monthly-trend
# Line chart data: month-by-month reductions
# ─────────────────────────────────────────────────────────────

@emissions_bp.route('/monthly-trend', methods=['GET'])
@jwt_required()
@role_required(['analyst', 'environment_manager', 'operations_department', 'operator'])
def get_monthly_trend():
    """
    Returns month-by-month emission reduction data for line/bar charts.

    This endpoint calculates trends directly from monthly operational data
    (not from stored emission_results) for maximum detail.

    How charts receive data:
      Recharts BarChart needs data in this format:
        [
          { month: "Jan", water_reduction: 420, solar_reduction: 680 },
          { month: "Feb", water_reduction: 380, solar_reduction: 720 },
          ...
        ]

    Query parameters:
      year (int): Filter by year
    """
    year = request.args.get('year', datetime.now().year, type=int)
    MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    # Aggregate water pump hours by month
    from sqlalchemy import func
    water_monthly = db.session.query(
        MonthlyWaterData.month,
        func.sum(MonthlyWaterData.pump_operating_hours).label('total_hours')
    ).filter(MonthlyWaterData.year == year).group_by(MonthlyWaterData.month).all()

    # Aggregate solar grid consumption by month
    solar_monthly = db.session.query(
        MonthlyEnergyData.month,
        func.sum(MonthlyEnergyData.energy_consumed_from_grid).label('consumed'),
        func.sum(MonthlyEnergyData.energy_exported_to_grid).label('exported')
    ).filter(MonthlyEnergyData.year == year).group_by(MonthlyEnergyData.month).all()

    # Build lookup dicts
    water_by_month = {r.month: r.total_hours or 0 for r in water_monthly}
    solar_by_month = {r.month: {'consumed': r.consumed or 0, 'exported': r.exported or 0} for r in solar_monthly}

    trend_data = []
    for i, month_name in enumerate(MONTH_NAMES, 1):
        # Water emission reduction for this month
        hours = water_by_month.get(i, 0)
        pump_energy = hours * 7.5  # kWh (7.5 kW default pump)
        # Assume 70% solar coverage:
        grid_from_pump = pump_energy * 0.30
        water_baseline = pump_energy * PAKISTAN_GRID_EF
        water_project = grid_from_pump * PAKISTAN_GRID_EF
        water_reduction_kg = max(0, water_baseline - water_project)

        # Solar emission reduction for this month
        solar = solar_by_month.get(i, {'consumed': 0, 'exported': 0})
        solar_baseline = (solar['consumed'] + solar['exported']) * PAKISTAN_GRID_EF
        solar_project = solar['consumed'] * PAKISTAN_GRID_EF
        solar_reduction_kg = max(0, solar_baseline - solar_project)

        trend_data.append({
            "month": month_name,
            "month_num": i,
            "water_reduction_kg": round(water_reduction_kg, 2),
            "solar_reduction_kg": round(solar_reduction_kg, 2),
            "total_reduction_kg": round(water_reduction_kg + solar_reduction_kg, 2),
            "total_reduction_tco2": round((water_reduction_kg + solar_reduction_kg) / 1000, 4),
        })

    return jsonify({"year": year, "trend": trend_data}), 200


# ─────────────────────────────────────────────────────────────
# GET /api/emissions/system-comparison
# Bar chart: compare emission reductions across all systems
# ─────────────────────────────────────────────────────────────

@emissions_bp.route('/system-comparison', methods=['GET'])
@jwt_required()
@role_required(['analyst', 'environment_manager', 'operations_department', 'operator'])
def get_system_comparison():
    """
    Compares emission reduction performance across all water/solar systems.

    Useful for identifying which villages/systems show the most impact.
    Charts: Horizontal bar chart, sorted by reduction descending.

    Response format (for Recharts BarChart):
      [
        { "system": "Gulberg WS-001", "type": "water", "reduction_tco2": 8.5 },
        { "system": "G-5 Solar-002", "type": "solar", "reduction_tco2": 12.1 },
        ...
      ]
    """
    year = request.args.get('year', datetime.now().year, type=int)

    results = EmissionResult.query.filter_by(year=year).all()

    comparison = []
    for r in results:
        # Get system name for display
        if r.system_type == 'water':
            system = WaterSystem.query.get(r.system_id)
            name = f"{system.village} ({system.unique_identifier})" if system else r.system_id[:8]
        else:
            system = SolarSystem.query.get(r.system_id)
            name = f"{system.village} ({system.unique_identifier})" if system else r.system_id[:8]

        comparison.append({
            "system": name,
            "system_id": r.system_id,
            "type": r.system_type,
            "baseline_tco2": round((r.baseline_emission or 0) / 1000, 3),
            "project_tco2": round((r.project_emission or 0) / 1000, 3),
            "reduction_tco2": round((r.emission_reduction or 0) / 1000, 3),
            "reduction_kg": round(r.emission_reduction or 0, 2),
        })

    # Sort by reduction descending (best performers first)
    comparison.sort(key=lambda x: x['reduction_tco2'], reverse=True)

    return jsonify({
        "year": year,
        "systems": comparison,
        "total_tco2": round(sum(c['reduction_tco2'] for c in comparison), 3)
    }), 200


# ─────────────────────────────────────────────────────────────
# GET /api/emissions/audit/<result_id>
# Full audit trail for one emission result
# ─────────────────────────────────────────────────────────────

@emissions_bp.route('/audit/<result_id>', methods=['GET'])
@jwt_required()
@role_required(['analyst', 'environment_manager'])
def get_audit_trail(result_id):
    """
    Returns the full audit trail for one emission calculation.

    For MRV transparency:
      - Links calculation back to original monthly data
      - Shows emission factor used
      - Shows timestamp
      - Can be exported as PDF for climate credit verification

    This is important because:
      Gold Standard, Verra VCS and other carbon credit standards
      require EVERY calculation to be traceable to source data.
    """
    result = EmissionResult.query.get(result_id)
    if not result:
        return jsonify({"message": "Result not found"}), 404

    # Fetch original source records
    if result.system_type == 'water':
        source_records = MonthlyWaterData.query.filter_by(
            water_system_id=result.system_id,
            year=result.year
        ).all()
        source_data = [{
            "month": r.month,
            "pump_operating_hours": r.pump_operating_hours,
            "total_water_pumped": r.total_water_pumped,
            "status": r.status
        } for r in source_records]

        system = WaterSystem.query.get(result.system_id)
        system_info = {"name": f"{system.village} - {system.unique_identifier}"} if system else {}
    else:
        source_records = MonthlyEnergyData.query.filter_by(
            solar_system_id=result.system_id,
            year=result.year
        ).all()
        source_data = [{
            "month": r.month,
            "energy_consumed_from_grid": r.energy_consumed_from_grid,
            "energy_exported_to_grid": r.energy_exported_to_grid,
            "status": r.status
        } for r in source_records]

        system = SolarSystem.query.get(result.system_id)
        system_info = {"name": f"{system.village} - {system.unique_identifier}"} if system else {}

    return jsonify({
        "result_id": str(result.id),
        "system_id": result.system_id,
        "system_type": result.system_type,
        "system_info": system_info,
        "year": result.year,
        "calculated_at": result.calculated_at.isoformat() if result.calculated_at else None,
        "emission_factor_used": PAKISTAN_GRID_EF,
        "methodology": "IPCC AR6 / NEPRA Grid EF / GS MRV v2",
        "results": {
            "baseline_emission_kg": round(result.baseline_emission or 0, 2),
            "project_emission_kg": round(result.project_emission or 0, 2),
            "emission_reduction_kg": round(result.emission_reduction or 0, 2),
            "emission_reduction_tco2": round((result.emission_reduction or 0) / 1000, 4),
        },
        "source_data_records": len(source_data),
        "source_data": source_data,
    }), 200

from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.models import WaterSystem, MonthlyWaterData, SolarSystem, MonthlyEnergyData, User
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.utils.decorators import role_required
import uuid

analyst_bp = Blueprint('analyst', __name__)

# Dashboard Data APIs
@analyst_bp.route('/dashboard/stats', methods=['GET'])
@jwt_required()
@role_required(['analyst', 'environment_manager', 'operations_department', 'operator'])
def get_stats():
    tehsil = request.args.get('tehsil')
    village = request.args.get('village')

    # Basic count-based logic (simplified for beginner)
    query_water = WaterSystem.query
    query_solar = SolarSystem.query
    
    if tehsil:
        query_water = query_water.filter_by(tehsil=tehsil)
        query_solar = query_solar.filter_by(tehsil=tehsil)
    
    return jsonify({
        "water_facilities": query_water.count(),
        "solar_facilities": query_solar.count(),
        "total_reports": MonthlyWaterData.query.count() + MonthlyEnergyData.query.count()
    }), 200

# Verification APIs
@analyst_bp.route('/submissions', methods=['GET'])
@jwt_required()
@role_required(['analyst', 'environment_manager'])
def get_submissions():
    # Fetch all "submitted" records (NOT drafts)
    water_submissions = MonthlyWaterData.query.filter_by(status='submitted').all()
    
    # We map data to list format for Frontend
    submissions = []
    for s in water_submissions:
        submissions.append({
            "id": str(s.id),
            "type": "water",
            "year": s.year,
            "month": s.month,
            "village": s.system.village,
            "status": s.status
        })
    
    return jsonify(submissions), 200

@analyst_bp.route('/submission/<uuid:record_id>/verify', methods=['PUT'])
@jwt_required()
@role_required(['analyst'])
def verify_submission(record_id):
    # This is where an Analyst "approves" the user entry
    data = request.get_json()
    status = data.get('status') # 'verified' or 'rejected'
    
    # Check if it's a water record
    record = MonthlyWaterData.query.get(record_id)
    if not record:
        record = MonthlyEnergyData.query.get(record_id)
        
    if record:
        record.status = status
        db.session.commit()
        return jsonify({"message": f"Successfully updated status to {status}"}), 200
        
    return jsonify({"message": "Record not found"}), 404

@analyst_bp.route('/dashboard/charts', methods=['GET'])
@jwt_required()
@role_required(['analyst', 'environment_manager', 'operations_department'])
def get_charts():
    """
    Returns chart data for the dashboard.
    The frontend uses this data to draw bar/line charts dynamically.

    How React updates charts:
      1. useEffect() runs getDashboardCharts() when page loads
      2. setChartData(data) triggers a re-render
      3. Chart library (Recharts/Chart.js) draws the new data
    """
    from sqlalchemy import func

    # Monthly water data totals — last 6 months
    water_monthly = db.session.query(
        MonthlyWaterData.year,
        MonthlyWaterData.month,
        func.sum(MonthlyWaterData.total_water_pumped).label('total')
    ).group_by(MonthlyWaterData.year, MonthlyWaterData.month)\
     .order_by(MonthlyWaterData.year.desc(), MonthlyWaterData.month.desc())\
     .limit(6).all()

    # Monthly energy data totals — last 6 months
    energy_monthly = db.session.query(
        MonthlyEnergyData.year,
        MonthlyEnergyData.month,
        func.sum(MonthlyEnergyData.energy_consumed_from_grid).label('consumed'),
        func.sum(MonthlyEnergyData.energy_exported_to_grid).label('exported')
    ).group_by(MonthlyEnergyData.year, MonthlyEnergyData.month)\
     .order_by(MonthlyEnergyData.year.desc(), MonthlyEnergyData.month.desc())\
     .limit(6).all()

    water_trends = [
        {"period": f"{r.year}-{str(r.month).zfill(2)}", "total_water_pumped": r.total or 0}
        for r in reversed(water_monthly)
    ]
    solar_trends = [
        {"period": f"{r.year}-{str(r.month).zfill(2)}",
         "energy_consumed": r.consumed or 0,
         "energy_exported": r.exported or 0}
        for r in reversed(energy_monthly)
    ]

    return jsonify({
        "water_trends": water_trends,
        "solar_trends": solar_trends,
    }), 200

"""
Prediction Routes
=================
API endpoints for AI predictions.

Endpoints:
- POST /api/predictions/water-demand - Predict water demand
- POST /api/predictions/solar-generation - Predict solar generation
- POST /api/predictions/grid-consumption - Predict grid consumption
- GET /api/predictions/all - Get all predictions
- POST /api/predictions/train - Retrain models
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
import pandas as pd

from app.ai_models import (
    prepare_water_dataset,
    prepare_solar_dataset,
    prepare_grid_dataset,
    train_water_model,
    predict_water_demand,
    train_solar_model,
    predict_solar_generation,
    train_grid_model,
    predict_grid_consumption,
    fetch_water_data,
    fetch_solar_data
)
from app.models.models import User, WaterSystem, SolarSystem

predictions_bp = Blueprint('predictions', __name__, url_prefix='/api/predictions')


def get_location_filters():
    """Extract location filters from request."""
    tehsil = request.args.get('tehsil')
    village = request.args.get('village')
    return tehsil, village


def get_unique_locations():
    """Get unique tehsils and villages for filters."""
    water_systems = WaterSystem.query.all()
    solar_systems = SolarSystem.query.all()
    
    tehsils = set()
    villages = set()
    
    for system in water_systems:
        if system.tehsil:
            tehsils.add(system.tehsil)
        if system.village:
            villages.add(system.village)
    
    for system in solar_systems:
        if system.tehsil:
            tehsils.add(system.tehsil)
        if system.village:
            villages.add(system.village)
    
    return {
        'tehsils': sorted(list(tehsils)),
        'villages': sorted(list(villages))
    }


@predictions_bp.route('/locations', methods=['GET'])
@jwt_required()
def get_locations():
    """Get available locations for filtering."""
    locations = get_unique_locations()
    return jsonify(locations)


@predictions_bp.route('/water-demand', methods=['POST'])
@jwt_required()
def predict_water():
    """
    Predict water demand for future months.
    
    Request body (optional):
    {
        "months": 6,  // Number of months to predict
        "tehsil": "Khewat",
        "village": "Village 1"
    }
    
    Returns:
    {
        "predictions": [...],
        "historical": [...],
        "model_metrics": {...}
    }
    """
    data = request.get_json() or {}
    months = data.get('months', 6)
    tehsil = data.get('tehsil')
    village = data.get('village')
    
    # Prepare dataset
    df = prepare_water_dataset(tehsil, village)
    
    if df.empty:
        return jsonify({
            'message': 'No historical data available for prediction',
            'predictions': [],
            'historical': []
        }), 200
    
    # Get historical data (last 12 months)
    historical = df.sort_values(['year', 'month']).tail(12)
    historical_data = []
    for _, row in historical.iterrows():
        historical_data.append({
            'year': int(row['year']),
            'month': int(row['month']),
            'value': float(row['total_water_pumped'])
        })
    
    # Generate predictions
    try:
        predictions = predict_water_demand(df, months)
        
        return jsonify({
            'predictions': predictions,
            'historical': historical_data,
            'filter': {
                'tehsil': tehsil,
                'village': village
            }
        })
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'message': 'Prediction failed. Please ensure you have enough historical data.'
        }), 500


@predictions_bp.route('/solar-generation', methods=['POST'])
@jwt_required()
def predict_solar():
    """
    Predict solar energy generation for future months.
    """
    data = request.get_json() or {}
    months = data.get('months', 6)
    tehsil = data.get('tehsil')
    village = data.get('village')
    
    df = prepare_solar_dataset(tehsil, village)
    
    if df.empty:
        return jsonify({
            'message': 'No historical data available for prediction',
            'predictions': [],
            'historical': []
        }), 200
    
    historical = df.sort_values(['year', 'month']).tail(12)
    historical_data = []
    for _, row in historical.iterrows():
        historical_data.append({
            'year': int(row['year']),
            'month': int(row['month']),
            'value': float(row['net_solar_energy'])
        })
    
    try:
        predictions = predict_solar_generation(df, months)
        
        return jsonify({
            'predictions': predictions,
            'historical': historical_data,
            'filter': {
                'tehsil': tehsil,
                'village': village
            }
        })
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'message': 'Prediction failed.'
        }), 500


@predictions_bp.route('/grid-consumption', methods=['POST'])
@jwt_required()
def predict_grid():
    """
    Predict grid electricity consumption for future months.
    """
    data = request.get_json() or {}
    months = data.get('months', 6)
    tehsil = data.get('tehsil')
    village = data.get('village')
    
    df = prepare_grid_dataset(tehsil, village)
    
    if df.empty:
        return jsonify({
            'message': 'No historical data available for prediction',
            'predictions': [],
            'historical': []
        }), 200
    
    historical = df.sort_values(['year', 'month']).tail(12)
    historical_data = []
    for _, row in historical.iterrows():
        historical_data.append({
            'year': int(row['year']),
            'month': int(row['month']),
            'value': float(row['energy_consumed_from_grid'])
        })
    
    try:
        predictions = predict_grid_consumption(df, months)
        
        return jsonify({
            'predictions': predictions,
            'historical': historical_data,
            'filter': {
                'tehsil': tehsil,
                'village': village
            }
        })
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'message': 'Prediction failed.'
        }), 500


@predictions_bp.route('/all', methods=['POST'])
@jwt_required()
def predict_all():
    """
    Get all predictions in one call.
    """
    data = request.get_json() or {}
    months = data.get('months', 6)
    tehsil = data.get('tehsil')
    village = data.get('village')
    
    result = {}
    
    # Water demand
    try:
        df = prepare_water_dataset(tehsil, village)
        if not df.empty:
            result['water_demand'] = {
                'predictions': predict_water_demand(df, months),
                'has_data': True
            }
        else:
            result['water_demand'] = {'has_data': False}
    except:
        result['water_demand'] = {'has_data': False, 'error': 'Training required'}
    
    # Solar generation
    try:
        df = prepare_solar_dataset(tehsil, village)
        if not df.empty:
            result['solar_generation'] = {
                'predictions': predict_solar_generation(df, months),
                'has_data': True
            }
        else:
            result['solar_generation'] = {'has_data': False}
    except:
        result['solar_generation'] = {'has_data': False, 'error': 'Training required'}
    
    # Grid consumption
    try:
        df = prepare_grid_dataset(tehsil, village)
        if not df.empty:
            result['grid_consumption'] = {
                'predictions': predict_grid_consumption(df, months),
                'has_data': True
            }
        else:
            result['grid_consumption'] = {'has_data': False}
    except:
        result['grid_consumption'] = {'has_data': False, 'error': 'Training required'}
    
    return jsonify(result)


@predictions_bp.route('/train', methods=['POST'])
@jwt_required()
def train_models():
    """
    Retrain all prediction models.
    
    Only analysts and environment managers can retrain models.
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if current_user.role not in ['analyst', 'environment_manager']:
        return jsonify({'error': 'Access denied. Only analysts can retrain models.'}), 403
    
    data = request.get_json() or {}
    tehsil = data.get('tehsil')
    village = data.get('village')
    
    results = {}
    
    # Train water model
    try:
        df = prepare_water_dataset(tehsil, village)
        if not df.empty:
            result = train_water_model(df)
            results['water_demand'] = {
                'status': 'success',
                'metrics': result['metrics']
            }
        else:
            results['water_demand'] = {'status': 'no_data'}
    except Exception as e:
        results['water_demand'] = {'status': 'error', 'message': str(e)}
    
    # Train solar model
    try:
        df = prepare_solar_dataset(tehsil, village)
        if not df.empty:
            result = train_solar_model(df)
            results['solar_generation'] = {
                'status': 'success',
                'metrics': result['metrics']
            }
        else:
            results['solar_generation'] = {'status': 'no_data'}
    except Exception as e:
        results['solar_generation'] = {'status': 'error', 'message': str(e)}
    
    # Train grid model
    try:
        df = prepare_grid_dataset(tehsil, village)
        if not df.empty:
            result = train_grid_model(df)
            results['grid_consumption'] = {
                'status': 'success',
                'metrics': result['metrics']
            }
        else:
            results['grid_consumption'] = {'status': 'no_data'}
    except Exception as e:
        results['grid_consumption'] = {'status': 'error', 'message': str(e)}
    
    return jsonify({
        'message': 'Model training completed',
        'results': results,
        'trained_at': datetime.utcnow().isoformat()
    })

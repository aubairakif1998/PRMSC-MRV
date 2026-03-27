"""
AI Models Package
================
Machine learning models for MRV prediction.

Models:
- Water Demand Predictor
- Solar Generation Predictor
- Grid Consumption Predictor
"""

from .data_preprocessing import (
    prepare_water_dataset,
    prepare_solar_dataset,
    prepare_grid_dataset,
    fetch_water_data,
    fetch_solar_data
)

from .water_demand_model import (
    WaterDemandPredictor,
    train_water_model,
    predict_water_demand
)

from .solar_generation_model import (
    SolarGenerationPredictor,
    train_solar_model,
    predict_solar_generation
)

from .grid_consumption_model import (
    GridConsumptionPredictor,
    train_grid_model,
    predict_grid_consumption
)

__all__ = [
    'prepare_water_dataset',
    'prepare_solar_dataset', 
    'prepare_grid_dataset',
    'fetch_water_data',
    'fetch_solar_data',
    'WaterDemandPredictor',
    'train_water_model',
    'predict_water_demand',
    'SolarGenerationPredictor',
    'train_solar_model',
    'predict_solar_generation',
    'GridConsumptionPredictor',
    'train_grid_model',
    'predict_grid_consumption',
]

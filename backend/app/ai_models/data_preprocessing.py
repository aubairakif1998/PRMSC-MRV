"""
Data Preprocessing Module
=========================
Prepares historical MRV data for machine learning models.

Why preprocessing is important:
- ML models need clean, normalized data
- Converts dates to numerical features (month, season)
- Handles missing values
- Normalizes feature scales
"""

import pandas as pd
import numpy as np
from datetime import datetime
from app.extensions import db
from app.models.models import WaterSystem, SolarSystem, MonthlyWaterData, MonthlyEnergyData


def fetch_water_data(tehsil=None, village=None, limit=1000):
    """
    Fetch historical water data from database.
    
    Returns DataFrame with columns:
    - year, month
    - village, tehsil
    - pump_operating_hours
    - total_water_pumped
    """
    query = db.session.query(
        MonthlyWaterData, WaterSystem
    ).join(
        WaterSystem, MonthlyWaterData.water_system_id == WaterSystem.id
    ).filter(
        MonthlyWaterData.status == 'approved'  # Only use verified data
    )
    
    if tehsil:
        query = query.filter(WaterSystem.tehsil == tehsil)
    if village:
        query = query.filter(WaterSystem.village == village)
    
    results = query.order_by(MonthlyWaterData.year.desc()).limit(limit).all()
    
    data = []
    for record, system in results:
        data.append({
            'id': record.id,
            'system_id': record.water_system_id,
            'unique_identifier': system.unique_identifier,
            'village': system.village,
            'tehsil': system.tehsil,
            'year': record.year,
            'month': record.month,
            'pump_operating_hours': record.pump_operating_hours or 0,
            'total_water_pumped': record.total_water_pumped or 0,
            'pump_flow_rate': system.pump_flow_rate or 10,  # Default 10 m3/hr
        })
    
    return pd.DataFrame(data)


def fetch_solar_data(tehsil=None, village=None, limit=1000):
    """
    Fetch historical solar energy data from database.
    
    Returns DataFrame with columns:
    - year, month
    - village, tehsil
    - energy_consumed_from_grid
    - energy_exported_to_grid
    - solar_panel_capacity
    """
    query = db.session.query(
        MonthlyEnergyData, SolarSystem
    ).join(
        SolarSystem, MonthlyEnergyData.solar_system_id == SolarSystem.id
    ).filter(
        MonthlyEnergyData.status == 'approved'  # Only use verified data
    )
    
    if tehsil:
        query = query.filter(SolarSystem.tehsil == tehsil)
    if village:
        query = query.filter(SolarSystem.village == village)
    
    results = query.order_by(MonthlyEnergyData.year.desc()).limit(limit).all()
    
    data = []
    for record, system in results:
        # Calculate net solar consumption
        net_solar = (record.energy_exported_to_grid or 0) - (record.energy_consumed_from_grid or 0)
        
        data.append({
            'id': record.id,
            'system_id': record.solar_system_id,
            'unique_identifier': system.unique_identifier,
            'village': system.village,
            'tehsil': system.tehsil,
            'year': record.year,
            'month': record.month,
            'energy_consumed_from_grid': record.energy_consumed_from_grid or 0,
            'energy_exported_to_grid': record.energy_exported_to_grid or 0,
            'net_solar_energy': net_solar,
            'solar_panel_capacity': system.solar_panel_capacity or 5,  # Default 5 kW
            'inverter_capacity': system.inverter_capacity or 5,
        })
    
    return pd.DataFrame(data)


def create_time_features(df):
    """
    Convert date information into numerical features for ML models.
    
    Features created:
    - month_sin, month_cos: Cyclical encoding (handles December → January wrap)
    - season: 0=winter, 1=spring, 2=summer, 3=autumn
    - quarter: 1-4
    """
    if df.empty:
        return df
    
    # Cyclical encoding for month (so ML knows Dec is close to Jan)
    df['month_sin'] = np.sin(2 * np.pi * df['month'] / 12)
    df['month_cos'] = np.cos(2 * np.pi * df['month'] / 12)
    
    # Season (for Pakistan climate)
    # Winter: Dec-Feb (12,1,2), Spring: Mar-Apr (3,4), Summer: May-Sep (5-9), Autumn: Oct-Nov (10,11)
    def get_season(month):
        if month in [12, 1, 2]:
            return 0  # Winter
        elif month in [3, 4]:
            return 1  # Spring
        elif month in [5, 6, 7, 8, 9]:
            return 2  # Summer
        else:
            return 3  # Autumn
    
    df['season'] = df['month'].apply(get_season)
    
    # Quarter
    df['quarter'] = ((df['month'] - 1) // 3) + 1
    
    return df


def handle_missing_values(df, target_column):
    """
    Handle missing values in the target column.
    
    Strategies:
    - Forward fill: Use previous month's value
    - Backward fill: Use next month's value
    - Mean: Fill with average
    """
    if df.empty or target_column not in df.columns:
        return df
    
    # Forward fill then backward fill
    df[target_column] = df[target_column].fillna(method='ffill')
    df[target_column] = df[target_column].fillna(method='bfill')
    
    # If still missing, use mean
    if df[target_column].isna().any():
        df[target_column] = df[target_column].fillna(df[target_column].mean())
    
    return df


def normalize_features(df, columns):
    """
    Normalize numerical features to 0-1 range.
    
    Why normalize?
    - Helps ML models converge faster
    - Prevents one feature from dominating
    """
    for col in columns:
        if col in df.columns:
            min_val = df[col].min()
            max_val = df[col].max()
            if max_val > min_val:
                df[f'{col}_normalized'] = (df[col] - min_val) / (max_val - min_val)
            else:
                df[f'{col}_normalized'] = 0
    
    return df


def prepare_water_dataset(tehsil=None, village=None):
    """
    Complete dataset preparation for water demand prediction.
    
    Returns:
    - DataFrame with features and target
    """
    # Fetch data
    df = fetch_water_data(tehsil, village)
    
    if df.empty:
        return pd.DataFrame()
    
    # Create time features
    df = create_time_features(df)
    
    # Handle missing values
    df = handle_missing_values(df, 'total_water_pumped')
    df = handle_missing_values(df, 'pump_operating_hours')
    
    # Add lag features (previous months)
    df = df.sort_values(['system_id', 'year', 'month'])
    df['prev_month_water'] = df.groupby('system_id')['total_water_pumped'].shift(1)
    df['prev_2month_water'] = df.groupby('system_id')['total_water_pumped'].shift(2)
    
    # Fill lag NaNs
    df['prev_month_water'] = df['prev_month_water'].fillna(df['total_water_pumped'].mean())
    df['prev_2month_water'] = df['prev_2month_water'].fillna(df['total_water_pumped'].mean())
    
    return df


def prepare_solar_dataset(tehsil=None, village=None):
    """
    Complete dataset preparation for solar generation prediction.
    """
    df = fetch_solar_data(tehsil, village)
    
    if df.empty:
        return pd.DataFrame()
    
    # Create time features
    df = create_time_features(df)
    
    # Handle missing values
    df = handle_missing_values(df, 'net_solar_energy')
    df = handle_missing_values(df, 'energy_exported_to_grid')
    
    # Add lag features
    df = df.sort_values(['system_id', 'year', 'month'])
    df['prev_month_generation'] = df.groupby('system_id')['net_solar_energy'].shift(1)
    df['prev_month_generation'] = df['prev_month_generation'].fillna(df['net_solar_energy'].mean())
    
    return df


def prepare_grid_dataset(tehsil=None, village=None):
    """
    Complete dataset preparation for grid consumption prediction.
    """
    df = fetch_solar_data(tehsil, village)
    
    if df.empty:
        return pd.DataFrame()
    
    # Create time features
    df = create_time_features(df)
    
    # Handle missing values
    df = handle_missing_values(df, 'energy_consumed_from_grid')
    
    # Add lag features
    df = df.sort_values(['system_id', 'year', 'month'])
    df['prev_month_consumption'] = df.groupby('system_id')['energy_consumed_from_grid'].shift(1)
    df['prev_month_consumption'] = df['prev_month_consumption'].fillna(df['energy_consumed_from_grid'].mean())
    
    return df

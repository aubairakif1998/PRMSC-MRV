"""
Water Demand Prediction Model
============================
Uses machine learning to forecast future water supply demand.

Algorithms Used:
- Linear Regression (baseline model)
- Random Forest (ensemble method)

Why these models?
- Linear Regression: Simple, interpretable baseline
- Random Forest: Handles non-linear relationships, robust to outliers
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import pickle
import os

# Model configuration
MODEL_VERSION = '1.0.0'
MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models')


class WaterDemandPredictor:
    """
    Predicts future water demand based on historical data.
    """
    
    def __init__(self):
        self.model = None
        self.model_type = 'random_forest'
        self.is_trained = False
        self.feature_columns = [
            'month_sin', 'month_cos', 'season', 'quarter',
            'prev_month_water', 'prev_2month_water',
            'pump_flow_rate'
        ]
        self.target_column = 'total_water_pumped'
    
    def prepare_features(self, df):
        """Extract features for training/prediction."""
        if df.empty:
            return None
        
        # Check if all required columns exist
        for col in self.feature_columns:
            if col not in df.columns:
                return None
        
        X = df[self.feature_columns].copy()
        
        # Handle any remaining NaN
        X = X.fillna(0)
        
        return X
    
    def prepare_target(self, df):
        """Extract target variable."""
        if df.empty or self.target_column not in df.columns:
            return None
        return df[self.target_column].values
    
    def train(self, df):
        """
        Train the water demand prediction model.
        
        Args:
            df: DataFrame with historical water data
        """
        X = self.prepare_features(df)
        y = self.prepare_target(df)
        
        if X is None or y is None:
            raise ValueError("Invalid dataset - missing required columns")
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        # Train Random Forest (better for non-linear patterns)
        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            min_samples_split=5,
            random_state=42,
            n_jobs=-1
        )
        self.model.fit(X_train, y_train)
        
        # Evaluate
        y_pred = self.model.predict(X_test)
        
        self.metrics = {
            'mae': mean_absolute_error(y_test, y_pred),
            'rmse': np.sqrt(mean_squared_error(y_test, y_pred)),
            'r2': r2_score(y_test, y_pred)
        }
        
        self.is_trained = True
        self.training_samples = len(X_train)
        
        return self.metrics
    
    def predict_next_months(self, df, months=6):
        """
        Predict water demand for next N months.
        
        Uses iterative prediction - each prediction feeds into next.
        """
        if not self.is_trained:
            raise ValueError("Model not trained yet")
        
        predictions = []
        
        # Get the last known data point
        last_row = df.iloc[-1].copy()
        
        for i in range(months):
            # Update month
            next_month = ((last_row['month'] + i) % 12) + 1
            next_year = last_row['year'] + (last_row['month'] + i) // 12
            
            # Create feature row
            month_sin = np.sin(2 * np.pi * next_month / 12)
            month_cos = np.cos(2 * np.pi * next_month / 12)
            
            # Season
            if next_month in [12, 1, 2]:
                season = 0
            elif next_month in [3, 4]:
                season = 1
            elif next_month in [5, 6, 7, 8, 9]:
                season = 2
            else:
                season = 3
            
            quarter = ((next_month - 1) // 3) + 1
            
            # Use previous predictions for lag features
            if i == 0:
                prev_water = last_row.get('prev_month_water', last_row['total_water_pumped'])
                prev_2water = last_row.get('prev_2month_water', last_row['total_water_pumped'])
            else:
                prev_water = predictions[i-1]['predicted_value']
                prev_2water = predictions[i-1]['predicted_value']
            
            features = np.array([[
                month_sin, month_cos, season, quarter,
                prev_water, prev_2water,
                last_row.get('pump_flow_rate', 10)
            ]])
            
            # Predict
            predicted_value = self.model.predict(features)[0]
            
            # Ensure non-negative
            predicted_value = max(0, predicted_value)
            
            predictions.append({
                'year': int(next_year),
                'month': int(next_month),
                'predicted_value': round(predicted_value, 2),
                'confidence': 'medium'  # Could calculate actual confidence interval
            })
        
        return predictions
    
    def get_feature_importance(self):
        """Return which features matter most for predictions."""
        if not self.is_trained or self.model is None:
            return None
        
        importance = self.model.feature_importances_
        return dict(zip(self.feature_columns, importance.tolist()))
    
    def save_model(self, filepath=None):
        """Save trained model to file."""
        if not self.is_trained:
            raise ValueError("Model not trained yet")
        
        if filepath is None:
            os.makedirs(MODEL_DIR, exist_ok=True)
            filepath = os.path.join(MODEL_DIR, 'water_demand_model.pkl')
        
        with open(filepath, 'wb') as f:
            pickle.dump({
                'model': self.model,
                'model_type': self.model_type,
                'feature_columns': self.feature_columns,
                'metrics': self.metrics,
                'version': MODEL_VERSION
            }, f)
        
        return filepath
    
    def load_model(self, filepath=None):
        """Load trained model from file."""
        if filepath is None:
            filepath = os.path.join(MODEL_DIR, 'water_demand_model.pkl')
        
        if not os.path.exists(filepath):
            return False
        
        with open(filepath, 'rb') as f:
            data = pickle.load(f)
        
        self.model = data['model']
        self.model_type = data['model_type']
        self.feature_columns = data['feature_columns']
        self.metrics = data['metrics']
        self.is_trained = True
        
        return True


# Standalone training function
def train_water_model(df):
    """
    Train water demand model and return metrics.
    """
    predictor = WaterDemandPredictor()
    metrics = predictor.train(df)
    
    # Save model
    model_path = predictor.save_model()
    
    return {
        'metrics': metrics,
        'model_path': model_path,
        'feature_importance': predictor.get_feature_importance()
    }


# Standalone prediction function
def predict_water_demand(df, months=6):
    """
    Generate water demand predictions.
    """
    # Try to load existing model
    predictor = WaterDemandPredictor()
    
    if not predictor.load_model():
        # Train new model if none exists
        predictor.train(df)
    
    return predictor.predict_next_months(df, months)

"""
Grid Electricity Consumption Prediction Model
==========================================
Predicts future grid electricity consumption based on:
- Historical grid usage
- Solar generation (which reduces grid dependency)
- Seasonal patterns
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import pickle
import os

MODEL_VERSION = '1.0.0'
MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models')


class GridConsumptionPredictor:
    """
    Predicts grid electricity consumption.
    
    Key insight: Grid consumption = Total energy needed - Solar energy offset
    """
    
    def __init__(self):
        self.model = None
        self.model_type = 'random_forest'
        self.is_trained = False
        self.feature_columns = [
            'month_sin', 'month_cos', 'season', 'quarter',
            'prev_month_consumption',
            'solar_panel_capacity'
        ]
        self.target_column = 'energy_consumed_from_grid'
    
    def prepare_features(self, df):
        """Extract features for training/prediction."""
        if df.empty:
            return None
        
        for col in self.feature_columns:
            if col not in df.columns:
                return None
        
        X = df[self.feature_columns].copy()
        X = X.fillna(0)
        
        return X
    
    def prepare_target(self, df):
        """Extract target variable."""
        if df.empty or self.target_column not in df.columns:
            return None
        return df[self.target_column].values
    
    def train(self, df):
        """Train the grid consumption prediction model."""
        X = self.prepare_features(df)
        y = self.prepare_target(df)
        
        if X is None or y is None:
            raise ValueError("Invalid dataset - missing required columns")
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            min_samples_split=5,
            random_state=42,
            n_jobs=-1
        )
        self.model.fit(X_train, y_train)
        
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
        Predict grid consumption for next N months.
        
        Grid consumption tends to:
        - Increase in summer (more pumping)
        - Decrease when solar generation is high
        """
        if not self.is_trained:
            raise ValueError("Model not trained yet")
        
        predictions = []
        
        last_row = df.iloc[-1].copy()
        
        for i in range(months):
            next_month = ((last_row['month'] + i) % 12) + 1
            next_year = last_row['year'] + (last_row['month'] + i) // 12
            
            month_sin = np.sin(2 * np.pi * next_month / 12)
            month_cos = np.cos(2 * np.pi * next_month / 12)
            
            if next_month in [12, 1, 2]:
                season = 0
            elif next_month in [3, 4]:
                season = 1
            elif next_month in [5, 6, 7, 8, 9]:
                season = 2
            else:
                season = 3
            
            quarter = ((next_month - 1) // 3) + 1
            
            if i == 0:
                prev_consumption = last_row.get('prev_month_consumption', 
                                              last_row.get('energy_consumed_from_grid', 0))
            else:
                prev_consumption = predictions[i-1]['predicted_value']
            
            features = np.array([[
                month_sin, month_cos, season, quarter,
                prev_consumption,
                last_row.get('solar_panel_capacity', 5)
            ]])
            
            predicted_value = self.model.predict(features)[0]
            predicted_value = max(0, predicted_value)  # Non-negative
            
            predictions.append({
                'year': int(next_year),
                'month': int(next_month),
                'predicted_value': round(predicted_value, 2),
                'confidence': 'medium'
            })
        
        return predictions
    
    def get_feature_importance(self):
        """Return feature importance."""
        if not self.is_trained or self.model is None:
            return None
        
        importance = self.model.feature_importances_
        return dict(zip(self.feature_columns, importance.tolist()))
    
    def save_model(self, filepath=None):
        """Save trained model."""
        if not self.is_trained:
            raise ValueError("Model not trained yet")
        
        if filepath is None:
            os.makedirs(MODEL_DIR, exist_ok=True)
            filepath = os.path.join(MODEL_DIR, 'grid_consumption_model.pkl')
        
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
        """Load trained model."""
        if filepath is None:
            filepath = os.path.join(MODEL_DIR, 'grid_consumption_model.pkl')
        
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


def train_grid_model(df):
    """Train grid consumption model."""
    predictor = GridConsumptionPredictor()
    metrics = predictor.train(df)
    
    model_path = predictor.save_model()
    
    return {
        'metrics': metrics,
        'model_path': model_path,
        'feature_importance': predictor.get_feature_importance()
    }


def predict_grid_consumption(df, months=6):
    """Generate grid consumption predictions."""
    predictor = GridConsumptionPredictor()
    
    if not predictor.load_model():
        predictor.train(df)
    
    return predictor.predict_next_months(df, months)

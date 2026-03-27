from functools import wraps
from flask import jsonify, request
from flask_jwt_extended import get_jwt
from flask_jwt_extended import verify_jwt_in_request

def role_required(allowed_roles):
    """
    Custom decorator to protect routes based on user role.
    Example: @role_required(['analyst', 'environment_manager'])
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # Skip JWT verification for OPTIONS (Pre-flight) requests
            if request.method == 'OPTIONS':
                return fn(*args, **kwargs)
                
            # Verify the JWT is present in the request
            verify_jwt_in_request()
            
            # Get the claims (additional data) from the token
            claims = get_jwt()
            user_role = claims.get("role")
            
            if user_role not in allowed_roles:
                return jsonify({
                    "message": "Access Forbidden: Insufficient permissions",
                    "required_roles": allowed_roles,
                    "your_role": user_role
                }), 403
                
            return fn(*args, **kwargs)
        return wrapper
    return decorator

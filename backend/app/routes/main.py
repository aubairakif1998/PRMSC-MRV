from flask import Blueprint, jsonify

main_bp = Blueprint("main", __name__)


@main_bp.route("/")
def index():
    return jsonify({"status": "MRV API is running!", "version": "1.0.0"}), 200


@main_bp.route("/api/health")
def health():
    """Liveness for Render, k8s, etc. No auth."""
    return jsonify({"status": "ok"}), 200


@main_bp.route("/api/hello")
def hello():
    return jsonify({"message": "hello"}), 200


@main_bp.route("/api/debug/cors-test")
def cors_test():
    return jsonify({"status": "ok", "message": "CORS test endpoint"}), 200


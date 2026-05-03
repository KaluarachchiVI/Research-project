"""Auth routes for Phase 3: login, register, me (JWT-based)."""
import os
import re
import uuid
import logging
from datetime import datetime, timedelta, timezone

import jwt
from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash

from src.database.models import SessionLocal, User, init_db

logger = logging.getLogger(__name__)

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

# JWT secret from env; default for dev only
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24 * 7  # 7 days


def _get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _require_auth(f):
    """Decorator that injects current user from Authorization Bearer token."""
    from functools import wraps

    @wraps(f)
    def wrapped(*args, **kwargs):
        auth = request.headers.get("Authorization")
        if not auth or not auth.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401
        token = auth[7:].strip()
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except jwt.InvalidTokenError as e:
            logger.debug("Invalid JWT: %s", e)
            return jsonify({"error": "Invalid or expired token"}), 401
        user_id = payload.get("sub")
        if not user_id:
            return jsonify({"error": "Invalid token payload"}), 401
        db = SessionLocal()
        try:
            user = db.query(User).filter_by(user_id=user_id).first()
            if not user:
                return jsonify({"error": "User not found"}), 401
            return f(db=db, user=user, *args, **kwargs)
        finally:
            db.close()

    return wrapped


@auth_bp.route("/register", methods=["POST"])
def register():
    """Create a new user. Body: email, password, display_name (optional)."""
    init_db()
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")
    display_name = (data.get("display_name") or "").strip() or email.split("@")[0]

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "password must be at least 6 characters"}), 400
    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return jsonify({"error": "invalid email format"}), 400

    db = SessionLocal()
    try:
        if db.query(User).filter_by(email=email).first():
            return jsonify({"error": "email already registered"}), 409
        user_id = str(uuid.uuid4())
        user = User(
            user_id=user_id,
            email=email,
            password_hash=generate_password_hash(password, method="scrypt"),
            display_name=display_name,
        )
        db.add(user)
        db.commit()
        token = _make_token(user_id, display_name)
        return jsonify({
            "user_id": user_id,
            "display_name": display_name,
            "email": email,
            "token": token,
        }), 201
    finally:
        db.close()


@auth_bp.route("/login", methods=["POST"])
def login():
    """Validate credentials and return user_id, display_name, token."""
    init_db()
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")

    if not email or password is None:
        return jsonify({"error": "email and password are required"}), 400

    db = SessionLocal()
    try:
        user = db.query(User).filter_by(email=email).first()
        if not user or not check_password_hash(user.password_hash, password):
            return jsonify({"error": "Invalid email or password"}), 401
        token = _make_token(user.user_id, user.display_name)
        return jsonify({
            "user_id": user.user_id,
            "display_name": user.display_name,
            "email": user.email,
            "token": token,
        }), 200
    finally:
        db.close()


def _make_token(user_id: str, display_name: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "display_name": display_name,
        "iat": now,
        "exp": now + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


@auth_bp.route("/me", methods=["GET"])
def me():
    """Return current user from Authorization Bearer token."""
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return jsonify({"error": "Missing or invalid Authorization header"}), 401
    token = auth[7:].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid or expired token"}), 401
    user_id = payload.get("sub")
    display_name = payload.get("display_name", "")
    if not user_id:
        return jsonify({"error": "Invalid token payload"}), 401
    return jsonify({"user_id": user_id, "display_name": display_name}), 200

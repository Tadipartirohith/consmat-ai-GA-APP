"""Self-hosted auth: bcrypt + JWT, plus FastAPI role guards."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .config import cfg

bearer = HTTPBearer(auto_error=False)


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), h.encode())
    except ValueError:
        return False


def make_token(sub: str, role: str, extra: dict | None = None) -> str:
    a = cfg()["app"]
    now = datetime.now(timezone.utc)
    payload = {"sub": sub, "role": role, "iat": now,
               "exp": now + timedelta(minutes=a["access_token_ttl_min"]), **(extra or {})}
    return jwt.encode(payload, a["jwt_secret"], algorithm=a["jwt_alg"])


def decode(token: str) -> dict:
    a = cfg()["app"]
    return jwt.decode(token, a["jwt_secret"], algorithms=[a["jwt_alg"]])


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    from .store import store
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    try:
        payload = decode(creds.credentials)
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = store.users.get(payload.get("sub", "").lower())
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


def optional_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict | None:
    from .store import store
    if creds is None:
        return None
    try:
        payload = decode(creds.credentials)
    except Exception:
        return None
    return store.users.get(payload.get("sub", "").lower())


def require_role(*roles: str):
    def guard(user: dict = Depends(current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Requires role: {', '.join(roles)}")
        return user
    return guard

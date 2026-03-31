"""Authentication helpers: password hashing, JWT creation, user extraction."""
import bcrypt, jwt, random, string, re
from datetime import datetime, timezone, timedelta
from fastapi import Depends, Header, HTTPException
from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_HOURS
from db import db


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())

def create_token(user_id: str, role: str) -> str:
    return jwt.encode({
        "sub": user_id, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.now(timezone.utc)
    }, JWT_SECRET, algorithm=JWT_ALGORITHM)

def generate_patient_id() -> str:
    chars = string.ascii_uppercase + string.digits
    code = ''.join(random.choices(chars, k=6))
    return f"PAT-{code}"

async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_role(*roles):
    async def guard(user=Depends(get_current_user)):
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail=f"Access denied. Required role: {', '.join(roles)}")
        return user
    return guard

def user_response(user: dict) -> dict:
    safe_fields = ["id", "name", "email", "role", "patient_id", "specialty",
                   "license_number", "age", "gender", "phone", "blood_group",
                   "department", "hospital", "bio", "created_at"]
    return {k: user.get(k, "") for k in safe_fields if k in user}

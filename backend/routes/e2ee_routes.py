"""E2EE key management routes."""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid
from cryptography.hazmat.primitives import serialization
from db import db
from auth import get_current_user
from typing import Optional

router = APIRouter()

@router.post("/e2ee/register-public-key")
async def register_public_key(data: dict, user=Depends(get_current_user)):
    public_key_pem = data.get("public_key")
    if not public_key_pem:
        raise HTTPException(status_code=400, detail="public_key is required")
    try:
        serialization.load_pem_public_key(public_key_pem.encode())
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid PEM public key format")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "e2ee_public_key": public_key_pem,
            "e2ee_key_registered_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return {"status": "ok", "message": "Public key registered for E2EE"}

@router.get("/e2ee/public-key/{user_id}")
async def get_public_key(user_id: str, user=Depends(get_current_user)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "e2ee_public_key": 1, "name": 1, "role": 1})
    if not target or not target.get("e2ee_public_key"):
        raise HTTPException(status_code=404, detail="User has no registered E2EE public key")
    return {
        "user_id": user_id,
        "public_key": target["e2ee_public_key"],
        "name": target.get("name"),
        "role": target.get("role"),
    }

@router.post("/e2ee/exchange-key")
async def exchange_encrypted_key(data: dict, user=Depends(get_current_user)):
    recipient_id = data.get("recipient_id")
    encrypted_aes_key = data.get("encrypted_aes_key")
    context_id = data.get("context_id")
    if not all([recipient_id, encrypted_aes_key, context_id]):
        raise HTTPException(status_code=400, detail="recipient_id, encrypted_aes_key, and context_id required")
    key_exchange_doc = {
        "id": str(uuid.uuid4()),
        "sender_id": user["id"],
        "recipient_id": recipient_id,
        "context_id": context_id,
        "encrypted_aes_key": encrypted_aes_key,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.key_exchanges.insert_one(key_exchange_doc)
    return {"status": "ok", "exchange_id": key_exchange_doc["id"]}

@router.get("/e2ee/keys-for-me")
async def get_my_key_exchanges(context_id: Optional[str] = None, user=Depends(get_current_user)):
    q: dict = {"recipient_id": user["id"]}
    if context_id:
        q["context_id"] = context_id
    exchanges = await db.key_exchanges.find(q, {"_id": 0}).sort("created_at", -1).to_list(50)
    return exchanges

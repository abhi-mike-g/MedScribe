"""Sync routes: multi-device encrypted cloud sync."""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional, Dict
from db import db
from auth import get_current_user

router = APIRouter()


class RegisterDeviceRequest(BaseModel):
    device_id: str
    device_name: str = "Unknown Device"
    platform: str = "unknown"
    app_version: str = "1.0.0"


class SyncPushRequest(BaseModel):
    device_id: str
    preferences: Dict = {}
    timestamp: str = ""


@router.post("/sync/register-device")
async def register_device(data: RegisterDeviceRequest, user=Depends(get_current_user)):
    """Register or update a device for the current user."""
    now = datetime.now(timezone.utc).isoformat()
    existing = await db.devices.find_one(
        {"user_id": user["id"], "device_id": data.device_id}
    )
    if existing:
        await db.devices.update_one(
            {"user_id": user["id"], "device_id": data.device_id},
            {"$set": {
                "device_name": data.device_name,
                "platform": data.platform,
                "app_version": data.app_version,
                "last_seen": now,
            }}
        )
    else:
        await db.devices.insert_one({
            "user_id": user["id"],
            "device_id": data.device_id,
            "device_name": data.device_name,
            "platform": data.platform,
            "app_version": data.app_version,
            "registered_at": now,
            "last_seen": now,
            "last_sync": None,
        })
    return {"status": "ok", "device_id": data.device_id}


@router.post("/sync/push")
async def sync_push(data: SyncPushRequest, user=Depends(get_current_user)):
    """Push encrypted preferences and sync state from a device."""
    now = datetime.now(timezone.utc).isoformat()
    # Update sync state for this user
    await db.sync_state.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "preferences": data.preferences,
            "sync_timestamp": now,
            "last_device_id": data.device_id,
        }},
        upsert=True
    )
    # Update device last sync
    await db.devices.update_one(
        {"user_id": user["id"], "device_id": data.device_id},
        {"$set": {"last_sync": now, "last_seen": now}}
    )
    return {"status": "ok", "sync_timestamp": now}


@router.get("/sync/pull")
async def sync_pull(user=Depends(get_current_user)):
    """Pull the latest sync state for the current user."""
    state = await db.sync_state.find_one(
        {"user_id": user["id"]}, {"_id": 0}
    )
    if not state:
        return {
            "preferences": {},
            "sync_timestamp": None,
            "last_device_id": None,
        }
    return {
        "preferences": state.get("preferences", {}),
        "sync_timestamp": state.get("sync_timestamp"),
        "last_device_id": state.get("last_device_id"),
    }


@router.get("/sync/devices")
async def get_devices(user=Depends(get_current_user)):
    """List all registered devices for the current user."""
    devices = await db.devices.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("last_seen", -1).to_list(20)
    return devices


@router.delete("/sync/devices/{device_id}")
async def remove_device(device_id: str, user=Depends(get_current_user)):
    """Remove a device from the user's sync list."""
    result = await db.devices.delete_one(
        {"user_id": user["id"], "device_id": device_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"status": "ok", "message": f"Device {device_id} removed"}


@router.get("/sync/status")
async def sync_status(user=Depends(get_current_user)):
    """Get sync status summary for the user."""
    state = await db.sync_state.find_one({"user_id": user["id"]}, {"_id": 0})
    device_count = await db.devices.count_documents({"user_id": user["id"]})
    return {
        "synced": state is not None,
        "last_sync": state.get("sync_timestamp") if state else None,
        "device_count": device_count,
        "encryption": "AES-256-GCM",
    }

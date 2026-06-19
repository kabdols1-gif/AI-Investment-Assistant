"""Server-side log history routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query

from backend.services.audit_log import read_audit_events


router = APIRouter()


@router.get("/openapi")
async def get_openapi_call_logs(
    limit: int = Query(default=100, ge=1, le=500),
    days: int = Query(default=7, ge=1, le=30),
) -> dict[str, Any]:
    events = read_audit_events(event_prefix="openapi.", limit=limit, days=days)
    return {
        "status": "success",
        "data": {
            "events": events,
            "count": len(events),
            "limit": limit,
            "days": days,
        },
    }

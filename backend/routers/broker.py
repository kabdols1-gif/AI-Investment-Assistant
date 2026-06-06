"""Broker adapter status routes."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from backend.brokers.errors import NotConfiguredError
from backend.brokers.registry import get_broker_adapter, list_broker_adapters

router = APIRouter()


@router.get("/providers")
async def get_broker_providers():
    return {"status": "success", "items": list_broker_adapters()}


@router.get("/{broker_id}/capabilities")
async def get_broker_capabilities(broker_id: str):
    try:
        adapter = get_broker_adapter(broker_id)
        capabilities = await adapter.get_capabilities()
        return {"status": "success", "data": capabilities.model_dump()}
    except NotConfiguredError as exc:
        return JSONResponse(status_code=501, content=exc.to_response())


@router.post("/{broker_id}/test-connection")
async def test_broker_connection(broker_id: str):
    try:
        adapter = get_broker_adapter(broker_id)
        status = await adapter.test_connection()
        return {"status": status.status, "data": status.model_dump()}
    except NotConfiguredError as exc:
        return JSONResponse(status_code=501, content=exc.to_response())

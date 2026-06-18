"""KB OpenAPI integration routes."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.services.kb_openapi_service import (
    call_kb_b2c_openapi,
    issue_kb_b2c_token,
    register_kb_b2c_app,
)
from backend.services.openapi_runtime import get_runtime_settings


router = APIRouter()


class KBOpenApiAppRegistrationRequest(BaseModel):
    hndlCcd: str = Field(default="1", max_length=8)
    tloginId: str = Field(max_length=128)
    accountNo: str = Field(max_length=64)
    pwd: str = Field(max_length=2048)
    cellPhone: str = Field(max_length=64)
    email: str = Field(max_length=256)


class KBOpenApiProxyRequest(BaseModel):
    method: Literal["GET", "POST", "PUT", "PATCH", "DELETE"] = "POST"
    path: str = Field(max_length=4096)
    headers: dict[str, str] = Field(default_factory=dict)
    body: Any = None
    access_token: str | None = None


@router.get("/kb/b2c/defaults")
async def get_kb_b2c_defaults() -> dict[str, Any]:
    settings = get_runtime_settings()
    environment = settings.active_environment
    return {
        "status": "success",
        "data": {
            "runtimeMode": settings.mode,
            "appsBaseUrl": environment.kb_b2c_base_url,
            "tokenBaseUrl": environment.kb_b2c_token_base_url,
            "tokenPath": "/oauth2/token",
            "defaultApiPrefix": "/api/v1",
        },
    }


@router.post("/kb/b2c/token")
async def issue_kb_b2c_token_route() -> dict[str, Any]:
    result = await issue_kb_b2c_token()
    return {
        "status": "success",
        "data": {
            "base_url": result["base_url"],
            "client_id": result["client_id"],
            "token_received": bool(result["access_token"]),
            "raw_response_masked": result["raw_response_masked"],
        },
    }


@router.post("/kb/b2c/apps")
async def register_kb_b2c_app_route(request: KBOpenApiAppRegistrationRequest) -> dict[str, Any]:
    result = await register_kb_b2c_app(request.model_dump())
    return {"status": "success" if result["ok"] else "failed", "data": result}


@router.post("/kb/b2c/proxy")
async def proxy_kb_b2c_openapi_request(request: KBOpenApiProxyRequest) -> dict[str, Any]:
    result = await call_kb_b2c_openapi(
        method=request.method,
        path=request.path,
        body=request.body,
        headers=request.headers,
        access_token=request.access_token,
    )
    return {"status": "success" if result["ok"] else "failed", "data": result}

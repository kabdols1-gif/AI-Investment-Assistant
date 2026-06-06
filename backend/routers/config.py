"""Local configuration API routes."""

from fastapi import APIRouter

from backend.schemas.config import (
    KBConnectionTestResponse,
    ConfigStatus,
    ConfigUpdateResponse,
    KBConfigRequest,
    LLMConfigRequest,
)
from backend.services import secure_config
from backend.services.audit_log import append_audit_event
from backend.services.kb_openapi_service import test_kb_connection


router = APIRouter()


@router.get("/status", response_model=ConfigStatus)
async def get_config_status() -> ConfigStatus:
    return secure_config.config_status()


@router.post("/llm", response_model=ConfigUpdateResponse)
async def save_llm_config(request: LLMConfigRequest) -> ConfigUpdateResponse:
    config = secure_config.update_llm_config(
        provider=request.provider,
        api_key=request.api_key,
        base_url=request.base_url,
        model=request.model,
    )
    append_audit_event(
        "llm_config_updated",
        {
            "provider": request.provider,
            "has_api_key": bool(request.api_key),
            "base_url": request.base_url,
            "model": request.model,
        },
    )
    return ConfigUpdateResponse(
        message="LLM configuration saved.",
        config=secure_config.config_status(config),
    )


@router.post("/kb", response_model=ConfigUpdateResponse)
async def save_kb_config(request: KBConfigRequest) -> ConfigUpdateResponse:
    config = secure_config.update_kb_config(
        broker=request.broker,
        api_key=request.api_key,
        api_secret=request.api_secret,
        account=request.account,
        product_code=request.product_code,
        base_url=request.base_url,
    )
    append_audit_event(
        "kb_config_updated",
        {
            "broker": request.broker,
            "has_api_key": bool(request.api_key),
            "has_api_secret": bool(request.api_secret),
            "has_account": bool(request.account),
            "has_product_code": bool(request.product_code),
            "base_url": request.base_url,
        },
    )
    return ConfigUpdateResponse(
        message="OpenAPI configuration saved.",
        config=secure_config.config_status(config),
    )


@router.post("/kb/test", response_model=KBConnectionTestResponse)
async def test_kb_openapi_connection() -> KBConnectionTestResponse:
    result = await test_kb_connection()
    append_audit_event(
        "kb_connection_tested",
        {
            "status": result.status,
            "base_url": result.base_url,
            "token_received": result.token_received,
        },
    )
    return result

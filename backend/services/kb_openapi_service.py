"""OpenAPI connection helpers for the assistant settings screen."""

from __future__ import annotations

from typing import Any

import httpx

from backend.schemas.config import KBConnectionTestResponse
from backend.services import secure_config
from backend.services.masking import mask_sensitive


DEFAULT_KB_BASE_URL = "https://dbaasapi.kbsec.com:32484"
DEFAULT_SCOPE = "public security"


async def test_kb_connection() -> KBConnectionTestResponse:
    config = secure_config.load_config()
    kb_config = config["kb"]
    broker = kb_config.get("broker") or "kb"
    client_id = (kb_config.get("api_key") or "").strip()
    client_secret = (kb_config.get("api_secret") or "").strip()
    base_url = (kb_config.get("base_url") or DEFAULT_KB_BASE_URL).rstrip("/")

    if broker != "kb":
        return KBConnectionTestResponse(
            status="failed",
            message="현재 연결 테스트는 KB증권 BaaS/OpenAPI 형식만 지원합니다. 선택한 증권사 정보는 저장할 수 있습니다.",
            base_url=base_url,
        )

    if not client_id or not client_secret:
        return KBConnectionTestResponse(
            status="missing",
            message="App Key와 Secret Key를 먼저 저장해 주세요.",
            base_url=base_url,
        )

    payload: dict[str, Any] = {
        "dataHeader": {
            "udId": "AI_INVESTMENT_ASSISTANT",
            "subChannel": "local",
            "deviceModel": "Windows",
            "deviceOs": "Windows",
            "appName": "AI Investment Assistant",
            "appVersion": "0.1.0",
            "scrNo": "0000",
        },
        "dataBody": {
            "clientId": client_id,
            "clientSecret": client_secret,
            "grantType": "client_credentials",
            "scope": DEFAULT_SCOPE,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                f"{base_url}/baas/v2/baas_token_issue",
                headers={"Content-Type": "application/json"},
                json=payload,
            )
        body = response.json()
        masked = mask_sensitive(body)
        token_body = body.get("dataBody") if isinstance(body.get("dataBody"), dict) else body
        token = None
        if isinstance(token_body, dict):
            token = token_body.get("access_token") or token_body.get("accessToken")
        if response.is_success and token:
            return KBConnectionTestResponse(
                status="success",
                message="OpenAPI 토큰 발급 응답을 확인했습니다.",
                base_url=base_url,
                token_received=True,
                raw_response_masked=masked,
            )
        return KBConnectionTestResponse(
            status="failed",
            message="OpenAPI 응답은 받았지만 토큰을 확인하지 못했습니다.",
            base_url=base_url,
            raw_response_masked=masked,
        )
    except (httpx.HTTPError, ValueError) as exc:
        return KBConnectionTestResponse(
            status="failed",
            message=f"OpenAPI 연결 테스트에 실패했습니다: {exc.__class__.__name__}",
            base_url=base_url,
        )

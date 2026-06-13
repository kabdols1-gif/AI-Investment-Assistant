"""KB Securities OpenAPI/BaaS connection helpers.

AIA uses the B2C side of the KB OpenAPI sample project as the primary
integration surface:

- app registration: POST https://dopenapi.kbsec.com/service/apps
- token issue: POST https://ddeveloper.kbsec.com:32484/oauth2/token
- TR calls: POST https://ddeveloper.kbsec.com:32484/api/v1/{tr}
"""

from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException

from backend.schemas.config import KBConnectionTestResponse
from backend.services import secure_config
from backend.services.masking import mask_sensitive


DEFAULT_KB_B2C_APPS_BASE_URL = "https://dopenapi.kbsec.com"
DEFAULT_KB_B2C_TOKEN_BASE_URL = "https://ddeveloper.kbsec.com:32484"
DEFAULT_KB_B2B_BASE_URL = "https://dbaasapi.kbsec.com:32484"
ALLOWED_KB_HOST_SUFFIXES = ("kbsec.com", "localhost", "127.0.0.1")


def _device_header() -> dict[str, str]:
    return {
        "udId": "AI_INVESTMENT_ASSISTANT",
        "subChannel": "local",
        "deviceModel": "Windows",
        "deviceOs": "Windows",
        "carrier": "local",
        "connectionType": "local",
        "appName": "AI Investment Assistant",
        "appVersion": "0.1.0",
        "scrNo": "0000",
    }


def _kb_config() -> dict[str, Any]:
    return secure_config.load_config()["kb"]


def _configured_b2c_base_url(kb_config: dict[str, Any]) -> str:
    base_url = (kb_config.get("base_url") or DEFAULT_KB_B2C_TOKEN_BASE_URL).rstrip("/")
    host = (urlparse(base_url).hostname or "").lower()
    if "baasapi" in host or host == "dopenapi.kbsec.com":
        return DEFAULT_KB_B2C_TOKEN_BASE_URL
    return base_url


def _is_allowed_kb_url(url: str) -> bool:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    return parsed.scheme in {"http", "https"} and any(host == suffix or host.endswith(f".{suffix}") for suffix in ALLOWED_KB_HOST_SUFFIXES)


def _token_from_response(body: dict[str, Any]) -> str | None:
    token_body = body.get("dataBody") if isinstance(body.get("dataBody"), dict) else body
    if not isinstance(token_body, dict):
        return None
    return token_body.get("access_token") or token_body.get("accessToken")


def _client_id_from_response(body: dict[str, Any]) -> str | None:
    token_body = body.get("dataBody") if isinstance(body.get("dataBody"), dict) else body
    if not isinstance(token_body, dict):
        return None
    return token_body.get("clientId") or token_body.get("clinetId")


def _require_kb_credentials(kb_config: dict[str, Any]) -> tuple[str, str, str]:
    broker = kb_config.get("broker") or "kb"
    client_id = (kb_config.get("api_key") or "").strip()
    client_secret = (kb_config.get("api_secret") or "").strip()
    base_url = _configured_b2c_base_url(kb_config)

    if broker != "kb":
        raise HTTPException(status_code=400, detail="KB B2C OpenAPI requires broker=kb.")
    if not client_id or not client_secret:
        raise HTTPException(status_code=400, detail="Save KB B2C clientId/App Key and clientSecret/Secret first.")
    return client_id, client_secret, base_url


async def register_kb_b2c_app(payload: dict[str, Any]) -> dict[str, Any]:
    """Register or issue a KB B2C app key using the official B2C apps endpoint."""

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{DEFAULT_KB_B2C_APPS_BASE_URL}/service/apps",
            headers={"Content-Type": "application/json"},
            json=payload,
        )
    try:
        body = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="KB B2C app registration response was not JSON.") from exc

    return {
        "status": response.status_code,
        "ok": 200 <= response.status_code < 300,
        "body_masked": mask_sensitive(body),
    }


async def issue_kb_b2c_token() -> dict[str, Any]:
    """Issue a KB B2C OAuth2 access token using saved AIA settings."""

    kb_config = _kb_config()
    client_id, client_secret, base_url = _require_kb_credentials(kb_config)
    payload: dict[str, Any] = {
        "dataHeader": _device_header(),
        "dataBody": {
            "clientId": client_id,
            "clientSecret": client_secret,
            "grantType": "client_credentials",
        },
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            f"{base_url}/oauth2/token",
            headers={"Content-Type": "application/json"},
            json=payload,
        )
    try:
        body = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="KB B2C token response was not JSON.") from exc

    token = _token_from_response(body)
    if not response.is_success or not token:
        raise HTTPException(status_code=502, detail={"message": "KB B2C token issue failed.", "response": mask_sensitive(body)})

    return {
        "base_url": base_url,
        "access_token": token,
        "client_id": _client_id_from_response(body) or client_id,
        "raw_response_masked": mask_sensitive(body),
    }


async def call_kb_b2c_openapi(
    method: str,
    path: str,
    body: Any = None,
    headers: dict[str, str] | None = None,
    access_token: str | None = None,
) -> dict[str, Any]:
    """Call a KB B2C OpenAPI endpoint through the server-side proxy."""

    kb_config = _kb_config()
    client_id, _, base_url = _require_kb_credentials(kb_config)
    token_result = None
    token = access_token
    if not token:
        token_result = await issue_kb_b2c_token()
        token = token_result["access_token"]
        client_id = token_result.get("client_id") or client_id

    target_url = path if path.startswith(("http://", "https://")) else f"{base_url}/{path.lstrip('/')}"
    if not _is_allowed_kb_url(target_url):
        raise HTTPException(status_code=400, detail="Unsupported KB OpenAPI target URL.")

    outgoing_headers = {
        "Content-Type": "application/json",
        "Authorization": f"bearer {token}",
        "appKey": client_id,
        **{key: value for key, value in (headers or {}).items() if key.lower() not in {"host", "content-length"}},
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.request(
            method.upper(),
            target_url,
            headers=outgoing_headers,
            json=body if method.upper() in {"POST", "PUT", "PATCH"} else None,
        )

    return {
        "status": response.status_code,
        "ok": 200 <= response.status_code < 300,
        "headers": dict(response.headers),
        "body": response.text,
        "requestHeaders": mask_sensitive(outgoing_headers),
        "issuedToken": bool(token_result),
    }


async def test_kb_connection() -> KBConnectionTestResponse:
    kb_config = _kb_config()
    broker = kb_config.get("broker") or "kb"
    client_id = (kb_config.get("api_key") or "").strip()
    client_secret = (kb_config.get("api_secret") or "").strip()
    base_url = _configured_b2c_base_url(kb_config)

    if broker != "kb":
        return KBConnectionTestResponse(
            status="failed",
            message="KB B2C OpenAPI connection test is available only for the KB broker.",
            base_url=base_url,
        )

    if not client_id or not client_secret:
        return KBConnectionTestResponse(
            status="missing",
            message="Save B2C clientId/App Key and clientSecret/Secret first.",
            base_url=base_url,
        )

    try:
        result = await issue_kb_b2c_token()
        return KBConnectionTestResponse(
            status="success",
            message="KB B2C OpenAPI OAuth2 token response was confirmed.",
            base_url=base_url,
            token_received=True,
            raw_response_masked=result["raw_response_masked"],
        )
    except (httpx.HTTPError, ValueError, HTTPException) as exc:
        return KBConnectionTestResponse(
            status="failed",
            message=f"KB B2C OpenAPI connection test failed: {exc.__class__.__name__}",
            base_url=base_url,
        )

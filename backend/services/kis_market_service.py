"""Korea Investment Securities market-data helpers."""

from __future__ import annotations

import asyncio
import json
import os
import time
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import httpx
import websockets

from backend.services.audit_log import append_audit_event
from backend.services.masking import mask_sensitive
from backend.services.openapi_runtime import load_openapi_kis_credentials


KIS_QUOTE_TR_ID = "FHKST01010100"
KIS_REALTIME_TRADE_TR_ID = "H0STCNT0"
KIS_REAL_REST_BASE_URL = "https://openapi.koreainvestment.com:9443"
KIS_PAPER_REST_BASE_URL = "https://openapivts.koreainvestment.com:29443"
KIS_REAL_WEBSOCKET_URL = "ws://ops.koreainvestment.com:21000"
KIS_PAPER_WEBSOCKET_URL = "ws://ops.koreainvestment.com:31000"
TOKEN_CACHE_MARGIN_SECONDS = 60

_token_cache: dict[str, dict[str, Any]] = {}
_approval_cache: dict[str, dict[str, Any]] = {}
_token_locks: dict[str, asyncio.Lock] = {}
_approval_locks: dict[str, asyncio.Lock] = {}


class KISMarketServiceError(RuntimeError):
    """Raised when KIS market-data integration cannot return usable data."""


def _is_live_env(env_dv: str | None) -> bool:
    return (env_dv or "").strip().lower() in {"real", "prod", "production", "live"}


def _clean_text(value: Any) -> str:
    return str(value or "").strip().strip("\"'")


def _first_text(*values: Any) -> str:
    for value in values:
        cleaned = _clean_text(value)
        if cleaned:
            return cleaned
    return ""


def _first_env(*names: str) -> str:
    return _first_text(*(os.getenv(name) for name in names))


def _ai_investment_config_file() -> Path:
    if os.name == "nt":
        app_data = os.getenv("APPDATA")
        if app_data:
            return Path(app_data) / "AIInvestmentAssistant" / "config.json"
    if os.name == "posix" and hasattr(os, "uname") and os.uname().sysname == "Darwin":
        return Path.home() / "Library" / "Application Support" / "AIInvestmentAssistant" / "config.json"
    return Path.home() / ".config" / "AIInvestmentAssistant" / "config.json"


def _load_ai_investment_config() -> dict[str, Any]:
    path = _ai_investment_config_file()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def _load_config_credentials(live: bool) -> dict[str, str]:
    config = _load_ai_investment_config()
    broker = config.get("broker") if isinstance(config.get("broker"), dict) else {}
    kb = config.get("kb") if isinstance(config.get("kb"), dict) else {}
    provider = _first_text(broker.get("provider"), kb.get("broker"))
    if provider != "korea_investment":
        return {}

    base_url = _first_text(
        broker.get("real_base_url") if live else broker.get("paper_base_url"),
        broker.get("base_url"),
        kb.get("base_url") if provider == "korea_investment" else "",
    )
    return {
        "client_id": _first_text(broker.get("app_key"), kb.get("api_key")),
        "client_secret": _first_text(broker.get("app_secret"), kb.get("api_secret")),
        "base_url": base_url,
    }


def _load_kis_credentials(live: bool) -> dict[str, str]:
    mode = "REAL" if live else "PAPER"
    configured = _load_config_credentials(live)
    runtime_credentials = load_openapi_kis_credentials(live=live)
    return {
        "client_id": _first_text(
            _first_env(f"KIS_{mode}_CLIENT_ID", f"KIS_{mode}_APP_KEY"),
            _first_env("KIS_CLIENT_ID", "KIS_APP_KEY"),
            configured.get("client_id"),
            runtime_credentials.get("client_id"),
        ),
        "client_secret": _first_text(
            _first_env(f"KIS_{mode}_CLIENT_SECRET", f"KIS_{mode}_SECRET_KEY", f"KIS_{mode}_APP_SECRET"),
            _first_env("KIS_CLIENT_SECRET", "KIS_SECRET_KEY", "KIS_APP_SECRET"),
            configured.get("client_secret"),
            runtime_credentials.get("client_secret"),
        ),
        "base_url": _first_text(
            _first_env(f"KIS_{mode}_REST_BASE_URL", f"KIS_{mode}_BASE_URL"),
            _first_env("KIS_REST_BASE_URL", "KIS_BASE_URL"),
            configured.get("base_url"),
        ),
    }


def _kis_rest_base_url(live: bool, credentials: dict[str, str]) -> str:
    return _first_text(
        credentials.get("base_url"),
        KIS_REAL_REST_BASE_URL if live else KIS_PAPER_REST_BASE_URL,
    ).rstrip("/")


def _kis_websocket_url(live: bool) -> str:
    mode = "REAL" if live else "PAPER"
    return _first_text(
        _first_env(f"KIS_{mode}_WEBSOCKET_URL", f"KIS_{mode}_WS_URL"),
        _first_env("KIS_WEBSOCKET_URL", "KIS_WS_URL"),
        KIS_REAL_WEBSOCKET_URL if live else KIS_PAPER_WEBSOCKET_URL,
    )


def _resolve_credentials(live: bool) -> tuple[bool, dict[str, str]]:
    credentials = _load_kis_credentials(live)
    if not live and (not credentials.get("client_id") or not credentials.get("client_secret")):
        real_credentials = _load_kis_credentials(live=True)
        if real_credentials.get("client_id") and real_credentials.get("client_secret"):
            return True, real_credentials
    if not credentials.get("client_id") or not credentials.get("client_secret"):
        mode = "real" if live else "paper"
        raise KISMarketServiceError(f"KIS {mode} app key/secret is not configured.")
    return live, credentials


def _cache_key(kind: str, live: bool, client_id: str) -> str:
    return f"{kind}:{'real' if live else 'paper'}:{client_id}"


def _lock_for(locks: dict[str, asyncio.Lock], key: str) -> asyncio.Lock:
    lock = locks.get(key)
    if lock is None:
        lock = asyncio.Lock()
        locks[key] = lock
    return lock


def _record_kis_call(event: str, payload: dict[str, Any]) -> None:
    try:
        append_audit_event(event, payload)
    except Exception:
        pass


def _to_float(value: Any, default: float = 0.0) -> float:
    text = str(value or "").strip().replace(",", "")
    if not text:
        return default
    try:
        return float(text)
    except ValueError:
        return default


def _to_int(value: Any, default: int = 0) -> int:
    return int(_to_float(value, float(default)))


def _signed_value(value: Any, sign_code: Any) -> float:
    parsed = _to_float(value)
    sign = str(sign_code or "").strip()
    if sign in {"1", "2"}:
        return abs(parsed)
    if sign in {"4", "5"}:
        return -abs(parsed)
    if sign == "3":
        return 0.0
    return parsed


def _normalize_quote_output(stock_code: str, output: dict[str, Any], *, source: str) -> dict[str, Any]:
    sign_code = output.get("prdy_vrss_sign")
    return {
        "stock_code": stock_code,
        "price": _to_float(output.get("stck_prpr")),
        "change": _signed_value(output.get("prdy_vrss"), sign_code),
        "change_rate": _signed_value(output.get("prdy_ctrt"), sign_code),
        "open": _to_float(output.get("stck_oprc")),
        "high": _to_float(output.get("stck_hgpr")),
        "low": _to_float(output.get("stck_lwpr")),
        "previous_close": _to_float(output.get("stck_sdpr")),
        "volume": _to_int(output.get("acml_vol")),
        "trading_value": _to_float(output.get("acml_tr_pbmn")),
        "w52_high": _to_float(output.get("w52_hgpr")),
        "w52_low": _to_float(output.get("w52_lwpr")),
        "timestamp": output.get("stck_bsop_date") or None,
        "source": source,
        "raw": output,
    }


async def issue_kis_access_token(env_dv: str = "real", *, force_refresh: bool = False) -> dict[str, str]:
    live, credentials = _resolve_credentials(_is_live_env(env_dv))
    base_url = _kis_rest_base_url(live, credentials)
    client_id = credentials["client_id"]
    client_secret = credentials["client_secret"]
    cache_key = _cache_key("token", live, client_id)
    cached = _token_cache.get(cache_key)

    if cached and not force_refresh and float(cached.get("expires_at", 0)) > time.time():
        return {
            "access_token": str(cached["access_token"]),
            "client_id": client_id,
            "client_secret": client_secret,
            "base_url": base_url,
            "mode": "real" if live else "paper",
        }

    async with _lock_for(_token_locks, cache_key):
        cached = _token_cache.get(cache_key)
        if cached and not force_refresh and float(cached.get("expires_at", 0)) > time.time():
            return {
                "access_token": str(cached["access_token"]),
                "client_id": client_id,
                "client_secret": client_secret,
                "base_url": base_url,
                "mode": "real" if live else "paper",
            }

        payload = {
            "grant_type": "client_credentials",
            "appkey": client_id,
            "appsecret": client_secret,
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                f"{base_url}/oauth2/tokenP",
                headers={"Content-Type": "application/json"},
                json=payload,
            )

        try:
            body = response.json()
        except ValueError as exc:
            _record_kis_call(
                "kis.market.token",
                {
                    "provider": "kis",
                    "method": "POST",
                    "url": f"{base_url}/oauth2/tokenP",
                    "status_code": response.status_code,
                    "ok": False,
                    "response_body": response.text[:1000],
                    "error": "non_json_response",
                },
            )
            raise KISMarketServiceError("KIS token response was not JSON.") from exc

        token = body.get("access_token")
        _record_kis_call(
            "kis.market.token",
            {
                "provider": "kis",
                "method": "POST",
                "url": f"{base_url}/oauth2/tokenP",
                "status_code": response.status_code,
                "ok": response.is_success and bool(token),
                "request_body": mask_sensitive(payload),
                "response_body": mask_sensitive(body),
                "token_received": bool(token),
            },
        )
        if not response.is_success or not token:
            raise KISMarketServiceError("KIS token issue failed.")

        expires_in = _to_int(body.get("expires_in"), 86400)
        _token_cache[cache_key] = {
            "access_token": token,
            "expires_at": time.time() + max(60, expires_in - TOKEN_CACHE_MARGIN_SECONDS),
        }
        return {
            "access_token": str(token),
            "client_id": client_id,
            "client_secret": client_secret,
            "base_url": base_url,
            "mode": "real" if live else "paper",
        }


async def issue_kis_approval_key(env_dv: str = "real", *, force_refresh: bool = False) -> dict[str, str]:
    live, credentials = _resolve_credentials(_is_live_env(env_dv))
    base_url = _kis_rest_base_url(live, credentials)
    client_id = credentials["client_id"]
    client_secret = credentials["client_secret"]
    cache_key = _cache_key("approval", live, client_id)
    cached = _approval_cache.get(cache_key)

    if cached and not force_refresh and float(cached.get("expires_at", 0)) > time.time():
        return {
            "approval_key": str(cached["approval_key"]),
            "client_id": client_id,
            "base_url": base_url,
            "mode": "real" if live else "paper",
        }

    async with _lock_for(_approval_locks, cache_key):
        cached = _approval_cache.get(cache_key)
        if cached and not force_refresh and float(cached.get("expires_at", 0)) > time.time():
            return {
                "approval_key": str(cached["approval_key"]),
                "client_id": client_id,
                "base_url": base_url,
                "mode": "real" if live else "paper",
            }

        payload = {
            "grant_type": "client_credentials",
            "appkey": client_id,
            "secretkey": client_secret,
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                f"{base_url}/oauth2/Approval",
                headers={"Content-Type": "application/json"},
                json=payload,
            )

        try:
            body = response.json()
        except ValueError as exc:
            _record_kis_call(
                "kis.market.websocket_approval",
                {
                    "provider": "kis",
                    "method": "POST",
                    "url": f"{base_url}/oauth2/Approval",
                    "status_code": response.status_code,
                    "ok": False,
                    "response_body": response.text[:1000],
                    "error": "non_json_response",
                },
            )
            raise KISMarketServiceError("KIS approval response was not JSON.") from exc

        approval_key = body.get("approval_key")
        _record_kis_call(
            "kis.market.websocket_approval",
            {
                "provider": "kis",
                "method": "POST",
                "url": f"{base_url}/oauth2/Approval",
                "status_code": response.status_code,
                "ok": response.is_success and bool(approval_key),
                "request_body": mask_sensitive(payload),
                "response_body": mask_sensitive(body),
                "approval_key_received": bool(approval_key),
            },
        )
        if not response.is_success or not approval_key:
            raise KISMarketServiceError("KIS websocket approval key issue failed.")

        _approval_cache[cache_key] = {
            "approval_key": approval_key,
            "expires_at": time.time() + (23 * 60 * 60),
        }
        return {
            "approval_key": str(approval_key),
            "client_id": client_id,
            "base_url": base_url,
            "mode": "real" if live else "paper",
        }


async def get_kis_current_price(stock_code: str, env_dv: str = "real") -> dict[str, Any]:
    normalized_code = stock_code.strip().zfill(6)
    token = await issue_kis_access_token(env_dv)
    target_url = f"{token['base_url']}/uapi/domestic-stock/v1/quotations/inquire-price"
    headers = {
        "Content-Type": "application/json",
        "authorization": f"Bearer {token['access_token']}",
        "appkey": token["client_id"],
        "appsecret": token["client_secret"],
        "tr_id": KIS_QUOTE_TR_ID,
        "custtype": "P",
    }
    params = {
        "FID_COND_MRKT_DIV_CODE": "J",
        "FID_INPUT_ISCD": normalized_code,
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(target_url, headers=headers, params=params)

    try:
        body = response.json()
    except ValueError as exc:
        _record_kis_call(
            "kis.market.quote",
            {
                "provider": "kis",
                "method": "GET",
                "url": target_url,
                "status_code": response.status_code,
                "ok": False,
                "request_params": params,
                "response_body": response.text[:1000],
                "error": "non_json_response",
            },
        )
        raise KISMarketServiceError("KIS quote response was not JSON.") from exc

    output = body.get("output") if isinstance(body.get("output"), dict) else {}
    ok = response.is_success and body.get("rt_cd") in {None, "0"} and bool(output)
    _record_kis_call(
        "kis.market.quote",
        {
            "provider": "kis",
            "method": "GET",
            "url": target_url,
            "status_code": response.status_code,
            "ok": ok,
            "request_params": params,
            "response_body": mask_sensitive(body),
        },
    )
    if not ok:
        message = body.get("msg1") or body.get("msg_cd") or "KIS quote lookup failed."
        raise KISMarketServiceError(str(message))

    return _normalize_quote_output(normalized_code, output, source="kis_rest")


def parse_kis_realtime_trade_message(message: str) -> dict[str, Any] | None:
    text = message.strip()
    if not text or text.startswith("{"):
        return None

    parts = text.split("|")
    if len(parts) < 4 or parts[1] != KIS_REALTIME_TRADE_TR_ID:
        return None

    fields = "|".join(parts[3:]).split("^")
    if len(fields) < 15:
        return None

    stock_code = fields[0].strip()
    sign_code = fields[3] if len(fields) > 3 else ""
    return {
        "stock_code": stock_code,
        "trade_time": fields[1] if len(fields) > 1 else None,
        "price": _to_float(fields[2] if len(fields) > 2 else 0),
        "change": _signed_value(fields[4] if len(fields) > 4 else 0, sign_code),
        "change_rate": _signed_value(fields[5] if len(fields) > 5 else 0, sign_code),
        "open": _to_float(fields[7] if len(fields) > 7 else 0),
        "high": _to_float(fields[8] if len(fields) > 8 else 0),
        "low": _to_float(fields[9] if len(fields) > 9 else 0),
        "volume": _to_int(fields[13] if len(fields) > 13 else 0),
        "trading_value": _to_float(fields[14] if len(fields) > 14 else 0),
        "ask_price": _to_float(fields[10] if len(fields) > 10 else 0),
        "bid_price": _to_float(fields[11] if len(fields) > 11 else 0),
        "source": "kis_realtime",
    }


async def stream_kis_realtime_price(stock_code: str, env_dv: str = "real") -> AsyncIterator[dict[str, Any]]:
    async for parsed in stream_kis_realtime_prices([stock_code], env_dv):
        yield parsed


async def stream_kis_realtime_prices(stock_codes: list[str], env_dv: str = "real") -> AsyncIterator[dict[str, Any]]:
    normalized_codes = _normalize_realtime_stock_codes(stock_codes)
    if not normalized_codes:
        return

    approval = await issue_kis_approval_key(env_dv)
    live = approval.get("mode") == "real"
    websocket_url = _kis_websocket_url(live)
    subscribed_code_set = set(normalized_codes)

    async with websockets.connect(websocket_url, ping_interval=20, ping_timeout=20) as socket:
        for code in normalized_codes:
            await socket.send(json.dumps(_realtime_subscribe_payload(approval["approval_key"], code), ensure_ascii=False))

        async for raw_message in socket:
            message = raw_message.decode("utf-8", errors="ignore") if isinstance(raw_message, bytes) else str(raw_message)
            parsed = parse_kis_realtime_trade_message(message)
            if parsed and parsed.get("stock_code") in subscribed_code_set:
                yield parsed


def _normalize_realtime_stock_codes(stock_codes: list[str]) -> list[str]:
    normalized: list[str] = []
    seen = set()
    for code in stock_codes:
        text = str(code or "").strip().upper()
        if text.startswith("A") and text[1:].isdigit():
            text = text[1:]
        if text.isdigit():
            text = text.zfill(6)
        if not text or text in seen or not text.isdigit() or len(text) != 6:
            continue
        seen.add(text)
        normalized.append(text)
    return normalized


def _realtime_subscribe_payload(approval_key: str, stock_code: str) -> dict[str, Any]:
    return {
        "header": {
            "approval_key": approval_key,
            "custtype": "P",
            "tr_type": "1",
            "content-type": "utf-8",
        },
        "body": {
            "input": {
                "tr_id": KIS_REALTIME_TRADE_TR_ID,
                "tr_key": stock_code,
            }
        },
    }

"""Local secure configuration fallback.

This stores user-entered values outside the repository and only returns masked
status to callers. It is a development-friendly fallback for the MVP; platform
credential stores can replace the read/write functions later.
"""

from __future__ import annotations

import json
import os
from copy import deepcopy
from pathlib import Path
from typing import Any

from backend.schemas.config import ConfigStatus
from backend.services.openapi_runtime import apply_runtime_kb_defaults, get_runtime_settings
from backend.services.masking import mask_value


APP_NAME = "AIInvestmentAssistant"
DEFAULT_LLM_PROVIDER = "openai"
DEFAULT_LLM_MODEL = "gpt-4.1-mini"
SUPPORTED_LLM_PROVIDERS = {"openai", "anthropic", "gemini", "openai_compatible", "local"}

BROKER_NAMES = {
    "kb": "KB증권",
    "korea_investment": "한국투자증권",
    "mirae_asset": "미래에셋증권",
    "nh": "NH투자증권",
    "samsung": "삼성증권",
    "kiwoom": "키움증권",
    "shinhan": "신한투자증권",
    "daishin": "대신증권",
    "hana": "하나증권",
    "custom": "직접 입력",
}


def _config_dir() -> Path:
    if os.name == "nt":
        root = os.getenv("APPDATA")
        if root:
            return Path(root) / APP_NAME
    if os.name == "posix" and os.uname().sysname == "Darwin":
        return Path.home() / "Library" / "Application Support" / APP_NAME
    return Path.home() / ".config" / APP_NAME


CONFIG_DIR = _config_dir()
CONFIG_FILE = CONFIG_DIR / "config.json"

DEFAULT_CONFIG: dict[str, Any] = {
    "llm": {
        "provider": DEFAULT_LLM_PROVIDER,
        "api_key": "",
        "base_url": "",
        "model": DEFAULT_LLM_MODEL,
    },
    "kb": {
        "broker": "kb",
        "api_key": "",
        "api_secret": "",
        "account": "",
        "product_code": "",
        "base_url": "https://ddeveloper.kbsec.com:32484",
    },
    "broker": {
        "provider": "kb",
        "mode": "paper",
        "base_url": "",
        "paper_base_url": "",
        "real_base_url": "",
        "app_key": "",
        "app_secret": "",
        "account_no": "",
        "account_product_code": "01",
    },
    "security": {
        "live_enabled": False,
    },
}


def _merge_defaults(config: dict[str, Any]) -> dict[str, Any]:
    merged = deepcopy(DEFAULT_CONFIG)
    for section, value in config.items():
        if isinstance(value, dict) and isinstance(merged.get(section), dict):
            merged[section].update(value)
        else:
            merged[section] = value
    llm = merged.setdefault("llm", {})
    provider = llm.get("provider") or DEFAULT_LLM_PROVIDER
    if provider not in SUPPORTED_LLM_PROVIDERS:
        provider = DEFAULT_LLM_PROVIDER
    llm["provider"] = provider
    if not llm.get("model") or llm.get("model") == "mock-voice-intent":
        llm["model"] = DEFAULT_LLM_MODEL
    return merged


def load_config() -> dict[str, Any]:
    if not CONFIG_FILE.exists():
        return deepcopy(DEFAULT_CONFIG)
    try:
        data = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return deepcopy(DEFAULT_CONFIG)
    if not isinstance(data, dict):
        return deepcopy(DEFAULT_CONFIG)
    return _merge_defaults(data)


def effective_config(config: dict[str, Any] | None = None) -> dict[str, Any]:
    return apply_runtime_kb_defaults(_merge_defaults(config or load_config()))


def save_config(config: dict[str, Any]) -> dict[str, Any]:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    normalized = _merge_defaults(config)
    CONFIG_FILE.write_text(
        json.dumps(normalized, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    try:
        CONFIG_FILE.chmod(0o600)
    except OSError:
        pass
    return normalized


def update_llm_config(
    provider: str,
    api_key: str | None = None,
    base_url: str | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    config = load_config()
    config["llm"]["provider"] = provider
    if api_key is not None:
        config["llm"]["api_key"] = api_key.strip()
    if base_url is not None:
        config["llm"]["base_url"] = base_url.strip()
    if model is not None:
        config["llm"]["model"] = model.strip()
    return save_config(config)


def update_kb_config(
    broker: str | None = None,
    api_key: str | None = None,
    api_secret: str | None = None,
    account: str | None = None,
    product_code: str | None = None,
    base_url: str | None = None,
) -> dict[str, Any]:
    config = load_config()
    if broker is not None:
        config["kb"]["broker"] = broker.strip()
    if api_key is not None:
        config["kb"]["api_key"] = api_key.strip()
    if api_secret is not None:
        config["kb"]["api_secret"] = api_secret.strip()
    if account is not None:
        config["kb"]["account"] = account.strip()
    if product_code is not None:
        config["kb"]["product_code"] = product_code.strip()
    if base_url is not None:
        config["kb"]["base_url"] = base_url.strip()
    return save_config(config)


def config_status(config: dict[str, Any] | None = None) -> ConfigStatus:
    config = effective_config(config)
    settings = get_runtime_settings()
    llm = config["llm"]
    kb = config["kb"]
    llm_key = llm.get("api_key") or ""
    kb_key = kb.get("api_key") or ""
    kb_secret = kb.get("api_secret") or ""
    account = kb.get("account") or ""
    broker = kb.get("broker") or "kb"
    return ConfigStatus(
        runtime_mode=settings.mode,
        runtime_label="production" if settings.mode == "production" else "development",
        llm_provider=llm.get("provider") or DEFAULT_LLM_PROVIDER,
        llm_model=llm.get("model") or None,
        llm_base_url=llm.get("base_url") or None,
        llm_key_registered=bool(llm_key),
        llm_key_masked=mask_value(llm_key) if llm_key else None,
        kb_key_registered=bool(kb_key),
        kb_secret_registered=bool(kb_secret),
        kb_key_masked=mask_value(kb_key) if kb_key else None,
        kb_account_masked=mask_value(account) if account else None,
        broker_provider=broker,
        broker_name=BROKER_NAMES.get(broker, broker),
        kb_base_url=kb.get("base_url") or None,
        kb_b2c_base_url=kb.get("b2c_base_url") or None,
        kb_b2c_token_base_url=kb.get("b2c_token_base_url") or None,
        kb_b2b_base_url=kb.get("b2b_base_url") or None,
        kb_credential_source=kb.get("credential_source") or None,
        kb_environment=settings.active_environment.as_public_dict(),
        live_enabled=bool(config.get("security", {}).get("live_enabled", False)),
    )


def live_execution_enabled() -> bool:
    return bool(load_config().get("security", {}).get("live_enabled", False))

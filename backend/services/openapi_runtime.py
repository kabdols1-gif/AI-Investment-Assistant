"""Runtime environment helpers shared with the OpenAPI developer project."""

from __future__ import annotations

import os
from copy import deepcopy
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Literal


RuntimeMode = Literal["development", "production"]

DEFAULT_DEVELOPMENT_ENVIRONMENT = {
    "KB_B2C_BASE_URL": "https://ddeveloper.kbsec.com:32484",
    "KB_B2C_TOKEN_BASE_URL": "https://ddeveloper.kbsec.com:32484",
    "KB_B2B_BASE_URL": "https://dbaasapi.kbsec.com:32484",
    "KIS_REST_BASE_URL": "https://openapivts.koreainvestment.com:29443",
    "KIS_WEBSOCKET_URL": "ws://ops.koreainvestment.com:31000",
}
DEFAULT_PRODUCTION_ENVIRONMENT = {
    "KB_B2C_BASE_URL": "https://developer.kbsec.com",
    "KB_B2C_TOKEN_BASE_URL": "https://developer.kbsec.com",
    "KB_B2B_BASE_URL": "https://baasapi.kbsec.com:32484",
    "KIS_REST_BASE_URL": "https://openapi.koreainvestment.com:9443",
    "KIS_WEBSOCKET_URL": "ws://ops.koreainvestment.com:21000",
}


def _clean(value: str | None) -> str:
    return (value or "").strip().strip("\"'")


def _truthy(value: str | None) -> bool:
    return _clean(value).lower() in {"1", "true", "yes", "y", "on"}


def _first_env(*keys: str, default: str) -> str:
    for key in keys:
        value = _clean(os.getenv(key))
        if value:
            return value
    return default


def normalize_runtime_mode(value: str | None) -> RuntimeMode:
    normalized = _clean(value).lower()
    if normalized in {"prod", "production", "real", "live", "operate", "operation"}:
        return "production"
    return "development"


@dataclass(frozen=True)
class OpenApiEnvironmentSettings:
    kb_b2c_base_url: str
    kb_b2c_token_base_url: str
    kb_b2b_base_url: str
    kis_rest_base_url: str
    kis_websocket_url: str

    def as_public_dict(self) -> dict[str, str]:
        return {
            "kbB2cBaseUrl": self.kb_b2c_base_url,
            "kbB2cTokenBaseUrl": self.kb_b2c_token_base_url,
            "kbB2bBaseUrl": self.kb_b2b_base_url,
            "kisRestBaseUrl": self.kis_rest_base_url,
            "kisWebsocketUrl": self.kis_websocket_url,
        }


@dataclass(frozen=True)
class RuntimeSettings:
    mode: RuntimeMode
    expose_local_defaults: bool
    environments: dict[RuntimeMode, OpenApiEnvironmentSettings]

    @property
    def is_development(self) -> bool:
        return self.mode == "development"

    @property
    def active_environment(self) -> OpenApiEnvironmentSettings:
        return self.environments[self.mode]


def _environment_settings(mode: RuntimeMode) -> OpenApiEnvironmentSettings:
    if mode == "production":
        prefixes = ("AIS_OPENAPI_PRODUCTION", "AIS_OPENAPI_PROD")
        defaults = DEFAULT_PRODUCTION_ENVIRONMENT
    else:
        prefixes = ("AIS_OPENAPI_DEVELOPMENT", "AIS_OPENAPI_DEV")
        defaults = DEFAULT_DEVELOPMENT_ENVIRONMENT

    return OpenApiEnvironmentSettings(
        kb_b2c_base_url=_first_env(
            *(f"{prefix}_KB_B2C_BASE_URL" for prefix in prefixes),
            default=defaults["KB_B2C_BASE_URL"],
        ),
        kb_b2c_token_base_url=_first_env(
            *(f"{prefix}_KB_B2C_TOKEN_BASE_URL" for prefix in prefixes),
            default=defaults["KB_B2C_TOKEN_BASE_URL"],
        ),
        kb_b2b_base_url=_first_env(
            *(f"{prefix}_KB_B2B_BASE_URL" for prefix in prefixes),
            default=defaults["KB_B2B_BASE_URL"],
        ),
        kis_rest_base_url=_first_env(
            *(f"{prefix}_KIS_REST_BASE_URL" for prefix in prefixes),
            default=defaults["KIS_REST_BASE_URL"],
        ),
        kis_websocket_url=_first_env(
            *(f"{prefix}_KIS_WEBSOCKET_URL" for prefix in prefixes),
            default=defaults["KIS_WEBSOCKET_URL"],
        ),
    )


@lru_cache(maxsize=1)
def get_runtime_settings() -> RuntimeSettings:
    mode = normalize_runtime_mode(
        os.getenv("AIS_OPENAPI_MODE")
        or os.getenv("AIS_RUNTIME_MODE")
        or os.getenv("APP_ENV")
        or os.getenv("ENV")
        or os.getenv("NODE_ENV")
    )
    return RuntimeSettings(
        mode=mode,
        expose_local_defaults=mode == "development" or _truthy(os.getenv("AIS_OPENAPI_EXPOSE_LOCAL_DEFAULTS")),
        environments={
            "development": _environment_settings("development"),
            "production": _environment_settings("production"),
        },
    )


def _read_text(path: Path) -> str:
    for encoding in ("utf-8-sig", "utf-8", "cp949", "euc-kr"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
        except OSError:
            return ""
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _openapi_project_root() -> Path:
    configured = _clean(os.getenv("AIS_OPENAPI_PROJECT_ROOT"))
    if configured:
        return Path(configured)
    return _repo_root().parent / "OpenAPI"


def _key_file_path() -> Path:
    configured = _clean(os.getenv("AIS_OPENAPI_KEY_FILE"))
    if configured:
        return Path(configured)
    return _openapi_project_root() / "key.txt"


@lru_cache(maxsize=1)
def load_openapi_key_defaults() -> dict[str, str]:
    values: dict[str, str] = {}
    for line in _read_text(_key_file_path()).splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        values[key.strip().lower()] = value.strip()
    return values


def _first_key(values: dict[str, str], *keys: str) -> str:
    for key in keys:
        value = values.get(key.lower())
        if value:
            return value
    return ""


def load_openapi_b2c_credentials(settings: RuntimeSettings | None = None) -> dict[str, str]:
    settings = settings or get_runtime_settings()
    env_api_key = _first_env("KB_B2C_CLIENT_ID", "AIS_OPENAPI_B2C_CLIENT_ID", default="")
    env_api_secret = _first_env("KB_B2C_CLIENT_SECRET", "AIS_OPENAPI_B2C_CLIENT_SECRET", default="")
    env_grant_type = _first_env("KB_B2C_GRANT_TYPE", "AIS_OPENAPI_B2C_GRANT_TYPE", default="")
    if env_api_key or env_api_secret:
        return {
            "api_key": env_api_key,
            "api_secret": env_api_secret,
            "grant_type": env_grant_type or "client_credentials",
            "source": "environment",
        }
    if not settings.expose_local_defaults:
        return {}

    key_values = load_openapi_key_defaults()
    return {
        "api_key": _first_key(key_values, "b2cClientId", "b2c_client_id", "b2cAppKey", "b2c_app_key"),
        "api_secret": _first_key(
            key_values,
            "b2cClientSecret",
            "b2c_client_secret",
            "b2cSecretKey",
            "b2c_secret_key",
        ),
        "grant_type": _first_key(key_values, "b2cGrantType", "b2c_grant_type", "grantType", "grant_type")
        or "client_credentials",
        "source": "openapi_dev",
    }


def load_openapi_kis_credentials(settings: RuntimeSettings | None = None, *, live: bool | None = None) -> dict[str, str]:
    settings = settings or get_runtime_settings()
    use_live = settings.mode == "production" if live is None else live
    mode_label = "real" if use_live else "paper"
    env_prefixes = (
        ("KIS_REAL", "AIS_OPENAPI_KIS_REAL") if use_live else ("KIS_PAPER", "AIS_OPENAPI_KIS_PAPER")
    )
    env_client_id = _first_env(
        *(f"{prefix}_CLIENT_ID" for prefix in env_prefixes),
        *(f"{prefix}_APP_KEY" for prefix in env_prefixes),
        "KIS_CLIENT_ID",
        "KIS_APP_KEY",
        "AIS_OPENAPI_KIS_CLIENT_ID",
        "AIS_OPENAPI_KIS_APP_KEY",
        default="",
    )
    env_client_secret = _first_env(
        *(f"{prefix}_CLIENT_SECRET" for prefix in env_prefixes),
        *(f"{prefix}_SECRET_KEY" for prefix in env_prefixes),
        *(f"{prefix}_APP_SECRET" for prefix in env_prefixes),
        "KIS_CLIENT_SECRET",
        "KIS_SECRET_KEY",
        "KIS_APP_SECRET",
        "AIS_OPENAPI_KIS_CLIENT_SECRET",
        "AIS_OPENAPI_KIS_SECRET_KEY",
        "AIS_OPENAPI_KIS_APP_SECRET",
        default="",
    )
    if env_client_id or env_client_secret:
        return {
            "client_id": env_client_id,
            "client_secret": env_client_secret,
            "mode": mode_label,
            "source": "environment",
        }
    if not settings.expose_local_defaults:
        return {}

    key_values = load_openapi_key_defaults()
    if use_live:
        client_id = _first_key(
            key_values,
            "kisRealClientId",
            "kis_real_client_id",
            "kisRealAppKey",
            "kis_real_app_key",
        )
        client_secret = _first_key(
            key_values,
            "kisRealClientSecret",
            "kis_real_client_secret",
            "kisRealSecretKey",
            "kis_real_secret_key",
            "kisRealAppSecret",
            "kis_real_app_secret",
        )
    else:
        client_id = _first_key(
            key_values,
            "kisPaperClientId",
            "kis_paper_client_id",
            "kisPaperAppKey",
            "kis_paper_app_key",
        )
        client_secret = _first_key(
            key_values,
            "kisPaperClientSecret",
            "kis_paper_client_secret",
            "kisPaperSecretKey",
            "kis_paper_secret_key",
            "kisPaperAppSecret",
            "kis_paper_app_secret",
        )

    return {
        "client_id": client_id or _first_key(key_values, "kisClientId", "kis_client_id", "kisAppKey", "kis_app_key"),
        "client_secret": client_secret
        or _first_key(
            key_values,
            "kisClientSecret",
            "kis_client_secret",
            "kisSecretKey",
            "kis_secret_key",
            "kisAppSecret",
            "kis_app_secret",
        ),
        "mode": mode_label,
        "source": "openapi_dev",
    }


def apply_runtime_kb_defaults(config: dict) -> dict:
    """Return an effective config with OpenAPI dev B2C defaults filled in."""

    settings = get_runtime_settings()
    effective = deepcopy(config)
    kb = effective.setdefault("kb", {})
    environment = settings.active_environment
    saved_base_url = _clean(kb.get("base_url"))
    normalized_base_url = saved_base_url.lower()
    if (
        not saved_base_url
        or "baasapi" in normalized_base_url
        or normalized_base_url == "https://dopenapi.kbsec.com"
    ):
        kb["base_url"] = environment.kb_b2c_token_base_url

    if (kb.get("broker") or "kb") == "kb":
        credentials = load_openapi_b2c_credentials(settings)
        if not _clean(kb.get("api_key")) and credentials.get("api_key"):
            kb["api_key"] = credentials["api_key"]
            kb["credential_source"] = credentials.get("source") or "openapi"
        if not _clean(kb.get("api_secret")) and credentials.get("api_secret"):
            kb["api_secret"] = credentials["api_secret"]
            kb["credential_source"] = credentials.get("source") or "openapi"
    if settings.is_development and (kb.get("broker") or "kb") == "kb":
        try:
            import kb_auth

            kb_auth_config = kb_auth.load_config()
            dev_config = kb_auth_config.get("dev", {}) if isinstance(kb_auth_config.get("dev"), dict) else {}
            if not _clean(kb.get("account")) and _clean(dev_config.get("account")):
                kb["account"] = _clean(dev_config.get("account"))
            if not _clean(kb.get("product_code")) and _clean(dev_config.get("product_code")):
                kb["product_code"] = _clean(dev_config.get("product_code"))
        except Exception:
            pass

    if not kb.get("credential_source"):
        if _clean(kb.get("api_key")) or _clean(kb.get("api_secret")):
            kb["credential_source"] = "saved"
        else:
            kb["credential_source"] = "missing"

    kb["runtime_mode"] = settings.mode
    kb["b2c_base_url"] = environment.kb_b2c_base_url
    kb["b2c_token_base_url"] = environment.kb_b2c_token_base_url
    kb["b2b_base_url"] = environment.kb_b2b_base_url
    return effective

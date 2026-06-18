"""KB Securities B2B account and balance evaluation service.

The account workflow is intentionally kept behind a small transport boundary:
SAQM9006 resolves the user's comprehensive account, and SSQM2952 reads the
balance evaluation for that account.  A future B2C transport can implement the
same ``call`` shape without changing the router or response mapping.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Protocol

import requests
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad

import kb_auth as ka
from backend.services.audit_log import append_audit_event
from backend.services.masking import mask_sensitive, mask_value


ACCOUNT_LIST_SERVICE = "SAQM9006"
BALANCE_EVALUATION_SERVICE = "SSQM2952"
COMPREHENSIVE_ACCOUNT_PREFIX = "2"
DEFAULT_EXCHANGE_MARKET_PRICE_CODE = "A"
BALANCE_CACHE_TTL_SECONDS = 15
AUTH_RETRY_STATUS_CODES = {401, 403}
AUTH_RETRY_KEYWORDS = (
    "access token",
    "authorization",
    "bearer",
    "expired",
    "invalid_token",
    "token",
    "unauthorized",
    "권한",
    "만료",
    "인증",
    "토큰",
)


class KBAccountServiceError(RuntimeError):
    """Raised when the KB account workflow cannot complete safely."""


@dataclass(frozen=True)
class KBAccountCandidate:
    account_no: str
    product_code: str
    product_name: str = ""
    account_name: str = ""
    display_account: str = ""
    raw: dict[str, Any] | None = None


@dataclass(frozen=True)
class KBBalanceEvaluation:
    account: KBAccountCandidate
    summary: dict[str, Any]
    holdings: list[dict[str, Any]]
    raw_response_masked: dict[str, Any]
    account_response_masked: dict[str, Any]
    fetched_at: str

    def as_balance_response(self) -> dict[str, Any]:
        return {
            **self.summary,
            "account_no": mask_value(self.account.account_no),
            "account_name": self.account.account_name,
            "product_code": self.account.product_code,
            "product_name": self.account.product_name,
            "holdings": self.holdings,
            "holdings_count": len(self.holdings),
            "raw_response_masked": self.raw_response_masked,
            "account_response_masked": self.account_response_masked,
            "fetched_at": self.fetched_at,
            "source": "kb-b2b",
        }


class KBOpenApiAccountTransport(Protocol):
    def call(
        self,
        service_code: str,
        data_body: dict[str, Any],
        *,
        encrypt_password_field: bool = False,
    ) -> dict[str, Any]:
        ...


class KBB2BOpenApiTransport:
    """B2B transport matching the KB sample Postman/OpenAPI test project."""

    def __init__(self, mode: str | None = None) -> None:
        self.mode = mode or _current_ui_mode()
        self.cfg = ka.load_config()
        self.mode_cfg = _mode_config(self.cfg, self.mode)
        self.access_token = self._ensure_access_token(force_refresh=False)
        self.client_secret = (self.mode_cfg.get("client_secret") or "").strip()
        self.base_url = (self.mode_cfg.get("base_url") or ka.DEFAULT_BASE_URL).rstrip("/")
        if not self.client_secret:
            raise KBAccountServiceError("KB B2B client_secret is required for encrypted TR requests.")

    def _ensure_access_token(self, *, force_refresh: bool) -> str:
        token = _ensure_b2b_account_token(self.mode, self.mode_cfg, force_refresh=force_refresh)
        if not token:
            raise KBAccountServiceError("KB B2B access token issue returned an empty token.")
        self.access_token = token
        return token

    def call(
        self,
        service_code: str,
        data_body: dict[str, Any],
        *,
        encrypt_password_field: bool = False,
    ) -> dict[str, Any]:
        return self._call_once(
            service_code,
            data_body,
            encrypt_password_field=encrypt_password_field,
            allow_token_retry=True,
        )

    def _call_once(
        self,
        service_code: str,
        data_body: dict[str, Any],
        *,
        encrypt_password_field: bool,
        allow_token_retry: bool,
    ) -> dict[str, Any]:
        if not (self.access_token or "").strip():
            self._ensure_access_token(force_refresh=True)

        path_code = service_code.lower()
        url = f"{self.base_url}/baas/v2/{path_code}"
        payload = {
            "dataHeader": _device_header(self.cfg, encrypt_password_field=encrypt_password_field),
            "dataBody": data_body,
        }
        plain_body = _compact_body(payload)
        request_body = {"encrypt": _encrypt_ecb_pkcs7(self.client_secret, plain_body)}
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"bearer {self.access_token}",
            "hsKey": _make_hs_key(self.access_token, plain_body),
        }

        try:
            response = requests.post(url, headers=headers, json=request_body, timeout=30)
        except requests.RequestException as exc:
            _record_openapi_call(
                "openapi.b2b.call",
                {
                    "provider": "kb",
                    "mode": "b2b",
                    "service_code": service_code,
                    "method": "POST",
                    "url": url,
                    "status_code": None,
                    "ok": False,
                    "request_headers": headers,
                    "request_body": data_body,
                    "error": str(exc),
                },
            )
            raise KBAccountServiceError(f"KB {service_code} request failed: {exc}") from exc

        raw_body = _parse_response_json(response.text)
        try:
            body = _decrypt_response_if_needed(raw_body, self.client_secret)
        except Exception as exc:
            _record_openapi_call(
                "openapi.b2b.call",
                {
                    "provider": "kb",
                    "mode": "b2b",
                    "service_code": service_code,
                    "method": "POST",
                    "url": url,
                    "status_code": response.status_code,
                    "ok": False,
                    "request_headers": headers,
                    "request_body": data_body,
                    "response_body": raw_body,
                    "error": str(exc),
                },
            )
            raise

        _record_openapi_call(
            "openapi.b2b.call",
            {
                "provider": "kb",
                "mode": "b2b",
                "service_code": service_code,
                "method": "POST",
                "url": url,
                "status_code": response.status_code,
                "ok": response.ok,
                "request_headers": headers,
                "request_body": data_body,
                "response_body": body,
            },
        )
        if _is_auth_failure_response(response.status_code, body):
            if allow_token_retry:
                _record_openapi_call(
                    "openapi.b2b.token_refresh",
                    {
                        "provider": "kb",
                        "mode": "b2b",
                        "service_code": service_code,
                        "reason": "missing_or_invalid_access_token",
                        "status_code": response.status_code,
                        "response_body": body,
                    },
                )
                self._ensure_access_token(force_refresh=True)
                return self._call_once(
                    service_code,
                    data_body,
                    encrypt_password_field=encrypt_password_field,
                    allow_token_retry=False,
                )
            raise KBAccountServiceError(
                f"KB {service_code} authentication failed after token refresh: {mask_sensitive(body)}"
            )
        if not response.ok:
            raise KBAccountServiceError(
                f"KB {service_code} returned HTTP {response.status_code}: {mask_sensitive(body)}"
            )
        if not isinstance(body, dict):
            raise KBAccountServiceError(f"KB {service_code} response was not a JSON object.")
        return body


_BALANCE_CACHE: KBBalanceEvaluation | None = None
_BALANCE_CACHE_EXPIRES_AT: datetime | None = None


def clear_kb_account_cache() -> None:
    global _BALANCE_CACHE, _BALANCE_CACHE_EXPIRES_AT
    _BALANCE_CACHE = None
    _BALANCE_CACHE_EXPIRES_AT = None


def _record_openapi_call(event: str, payload: dict[str, Any]) -> None:
    try:
        append_audit_event(event, payload)
    except Exception:
        pass


def get_kb_balance_evaluation(force_refresh: bool = False) -> KBBalanceEvaluation:
    global _BALANCE_CACHE, _BALANCE_CACHE_EXPIRES_AT
    now = datetime.now()
    if (
        not force_refresh
        and _BALANCE_CACHE is not None
        and _BALANCE_CACHE_EXPIRES_AT is not None
        and now < _BALANCE_CACHE_EXPIRES_AT
    ):
        return _BALANCE_CACHE

    transport = KBB2BOpenApiTransport()
    account_response = _call_account_list(transport)
    accounts = _parse_saqm9006_accounts(account_response)
    account = _select_single_comprehensive_account(accounts, transport.mode_cfg)
    balance_response = _call_balance_evaluation(transport, account)
    evaluation = KBBalanceEvaluation(
        account=account,
        summary=_parse_balance_summary(balance_response),
        holdings=_parse_balance_holdings(balance_response),
        raw_response_masked=mask_sensitive(balance_response),
        account_response_masked=mask_sensitive(account_response),
        fetched_at=now.isoformat(),
    )
    _BALANCE_CACHE = evaluation
    _BALANCE_CACHE_EXPIRES_AT = now + timedelta(seconds=BALANCE_CACHE_TTL_SECONDS)
    return evaluation


def _call_account_list(transport: KBOpenApiAccountTransport) -> dict[str, Any]:
    ci_no = (getattr(transport, "mode_cfg", {}).get("ci_no") or "").strip()
    if not ci_no:
        raise KBAccountServiceError("KB B2B ci_no is required for SAQM9006 account lookup.")
    response = transport.call(
        ACCOUNT_LIST_SERVICE,
        {
            "ciNo": ci_no,
            "nxtKey": "",
            "hpinNo": "",
        },
    )
    _raise_if_kb_business_error(ACCOUNT_LIST_SERVICE, response)
    return response


def _call_balance_evaluation(
    transport: KBOpenApiAccountTransport,
    account: KBAccountCandidate,
) -> dict[str, Any]:
    mode_cfg = getattr(transport, "mode_cfg", {})
    account_password = (mode_cfg.get("account_password") or "").strip()
    if not account_password:
        raise KBAccountServiceError(
            "KB B2B account_password is required for SSQM2952. "
            "Set it in ~/KB/config/kb_devlp.yaml or KB_DEV_ACCOUNT_PASSWORD/KB_PROD_ACCOUNT_PASSWORD."
        )

    response = transport.call(
        BALANCE_EVALUATION_SERVICE,
        {
            "gnlAcNo": account.account_no,
            "gdsNo": account.product_code,
            "pwd": account_password,
            "excgMktprCcd": DEFAULT_EXCHANGE_MARKET_PRICE_CODE,
            "spclzOrdrCcd": "",
        },
        encrypt_password_field=True,
    )
    _raise_if_kb_business_error(BALANCE_EVALUATION_SERVICE, response)
    return response


def _raise_if_kb_business_error(service_code: str, response: dict[str, Any]) -> None:
    body = _data_body(response)
    message = str(body.get("oMsg") or body.get("msg") or "").strip()
    if not message:
        return
    lowered = message.lower()
    error_keywords = ("오류", "에러", "실패", "불가", "error", "fail")
    if any(keyword in lowered for keyword in error_keywords):
        raise KBAccountServiceError(f"KB {service_code} business error: {message}")


def _is_auth_failure_response(status_code: int, response: Any) -> bool:
    if status_code in AUTH_RETRY_STATUS_CODES:
        return True
    message = _auth_failure_message(response).lower()
    return bool(message) and any(keyword in message for keyword in AUTH_RETRY_KEYWORDS)


def _auth_failure_message(response: Any) -> str:
    if not isinstance(response, dict):
        return str(response or "")
    body = _data_body(response)
    candidates = [
        response.get("error"),
        response.get("error_description"),
        response.get("message"),
        response.get("msg"),
        body.get("error"),
        body.get("error_description"),
        body.get("message"),
        body.get("msg"),
        body.get("oMsg"),
        body.get("rspMsg"),
        body.get("errMsg"),
    ]
    return " ".join(str(item) for item in candidates if item)


def _current_ui_mode() -> str:
    trenv = ka.getTREnv()
    return trenv.mode or ka.read_mode() or "vps"


def _mode_config(cfg: dict[str, Any], mode: str) -> dict[str, Any]:
    normalized = "prod" if mode in {"prod", "real"} else "dev"
    mode_cfg = cfg.get(normalized, {})
    return mode_cfg if isinstance(mode_cfg, dict) else {}


def _has_authorization_inputs(mode_cfg: dict[str, Any]) -> bool:
    if not (mode_cfg.get("ci_no") or "").strip():
        return False
    try:
        return bool(ka.resolve_user_info(mode_cfg))
    except ValueError:
        return False


def _ensure_b2b_account_token(mode: str, mode_cfg: dict[str, Any], *, force_refresh: bool = False) -> str:
    token_data = ka.read_token_data()
    ui_mode = "prod" if mode in {"prod", "real"} else "vps"
    if (
        token_data
        and token_data.get("mode") == ui_mode
        and token_data.get("grant_type") == "authorization_code"
        and not force_refresh
    ):
        return ka.auth(svr=ui_mode, grant_type="authorization_code")

    existing_token = ka.getTREnv().access_token or ka.read_token()
    if _has_authorization_inputs(mode_cfg):
        try:
            return ka.auth(svr=ui_mode, grant_type="authorization_code", force_refresh=True)
        except Exception as exc:
            if force_refresh or not existing_token:
                raise KBAccountServiceError(f"KB B2B authorization_code token issue failed: {exc}") from exc

    if existing_token and not force_refresh:
        return existing_token
    return ka.auth(svr=ui_mode, grant_type="client_credentials", force_refresh=force_refresh)


def _device_header(
    cfg: dict[str, Any],
    *,
    encrypt_password_field: bool = False,
) -> dict[str, str]:
    defaults = {
        "udId": "UDID",
        "subChannel": "subChannel",
        "deviceModel": "Android",
        "deviceOs": "Android",
        "carrier": "KT",
        "connectionType": "..",
        "appName": "..",
        "appVersion": "..",
        "scrNo": "0000",
    }
    configured = cfg.get("device", {}) if isinstance(cfg.get("device"), dict) else {}
    header = {key: str(configured.get(key) or value) for key, value in defaults.items()}
    if encrypt_password_field:
        header["encryptList"] = "pwd"
        header["encryptType"] = "ETOE"
    return header


def _compact_body(body: dict[str, Any]) -> str:
    return json.dumps(body, ensure_ascii=False, separators=(",", ":"))


def _make_hs_key(access_token: str, plain_body: str) -> str:
    digest_hex = hmac.new(
        access_token.encode("utf-8"),
        plain_body.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return base64.b64encode(digest_hex.encode("utf-8")).decode("ascii")


def _aes_key(client_secret: str) -> bytes:
    key = client_secret.encode("utf-8")
    if len(key) not in {16, 24, 32}:
        raise KBAccountServiceError("KB client_secret must be 16, 24, or 32 bytes for AES encryption.")
    return key


def _encrypt_ecb_pkcs7(client_secret: str, plain_body: str) -> str:
    cipher = AES.new(_aes_key(client_secret), AES.MODE_ECB)
    encrypted = cipher.encrypt(pad(plain_body.encode("utf-8"), AES.block_size))
    return base64.b64encode(encrypted).decode("ascii")


def _decrypt_ecb_pkcs7(client_secret: str, encrypted_body: str) -> str:
    cipher = AES.new(_aes_key(client_secret), AES.MODE_ECB)
    decrypted = unpad(cipher.decrypt(base64.b64decode(encrypted_body)), AES.block_size)
    return decrypted.decode("utf-8")


def _parse_response_json(text: str) -> Any:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"raw": text}


def _decrypt_response_if_needed(body: Any, client_secret: str) -> Any:
    if not isinstance(body, dict):
        return body
    encrypted_body = body.get("encrypt")
    if not isinstance(encrypted_body, str) or not encrypted_body.strip():
        return body
    try:
        decrypted = _decrypt_ecb_pkcs7(client_secret, encrypted_body)
        return _parse_response_json(decrypted)
    except Exception as exc:
        raise KBAccountServiceError("Failed to decrypt KB encrypted response.") from exc


def _data_body(response: dict[str, Any]) -> dict[str, Any]:
    data_body = response.get("dataBody")
    return data_body if isinstance(data_body, dict) else response


def _records(response: dict[str, Any], record_key: str = "Record1") -> list[dict[str, Any]]:
    data_body = _data_body(response)
    record_value = data_body.get(record_key)
    if isinstance(record_value, list):
        return [item for item in record_value if isinstance(item, dict)]
    if isinstance(record_value, dict):
        return [record_value]
    return []


def _parse_saqm9006_accounts(response: dict[str, Any]) -> list[KBAccountCandidate]:
    accounts: list[KBAccountCandidate] = []
    for record in _records(response):
        account_no = _clean_account_no(record.get("account"))
        if not account_no:
            continue
        accounts.append(
            KBAccountCandidate(
                account_no=account_no,
                product_code=str(record.get("stockNo") or "01").strip() or "01",
                product_name=str(record.get("stockName") or "").strip(),
                account_name=str(record.get("accountName") or "").strip(),
                display_account=str(record.get("displayAccount") or "").strip(),
                raw=record,
            )
        )
    return accounts


def _select_single_comprehensive_account(
    accounts: list[KBAccountCandidate],
    mode_cfg: dict[str, Any],
) -> KBAccountCandidate:
    configured_account = _clean_account_no(mode_cfg.get("account"))
    comprehensive_accounts = [
        account for account in accounts if account.account_no.startswith(COMPREHENSIVE_ACCOUNT_PREFIX)
    ]

    if configured_account:
        for account in comprehensive_accounts:
            if account.account_no == configured_account:
                return account

    if len(comprehensive_accounts) == 1:
        return comprehensive_accounts[0]

    if comprehensive_accounts:
        configured_product_code = str(mode_cfg.get("product_code") or "01").strip() or "01"
        return sorted(
            comprehensive_accounts,
            key=lambda item: (item.product_code != configured_product_code, item.account_no),
        )[0]

    if configured_account.startswith(COMPREHENSIVE_ACCOUNT_PREFIX):
        return KBAccountCandidate(
            account_no=configured_account,
            product_code=str(mode_cfg.get("product_code") or "01").strip() or "01",
            account_name="Configured KB comprehensive account",
        )

    raise KBAccountServiceError("SAQM9006 did not return a comprehensive account starting with 2.")


def _clean_account_no(value: Any) -> str:
    text = str(value or "").strip()
    return re.sub(r"[^0-9]", "", text)


def _to_number(value: Any) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value or "").strip().replace(",", "")
    if not text:
        return 0.0
    sign = -1 if text.endswith("-") else 1
    text = text.rstrip("-+")
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    if not match:
        return 0.0
    try:
        return sign * float(match.group(0))
    except ValueError:
        return 0.0


def _to_int(value: Any) -> int:
    return int(round(_to_number(value)))


def _parse_balance_summary(response: dict[str, Any]) -> dict[str, Any]:
    body = _data_body(response)
    deposit = _to_number(body.get("dyTfnd") or body.get("ndyTfnd") or body.get("nxtNdyTfnd"))
    eval_amount = _to_number(body.get("valAmtSum") or body.get("scrtsNtValAmt"))
    total_eval = _to_number(body.get("ntAstsValAmt")) or deposit + eval_amount
    purchase_amount = _to_number(body.get("byngAmtSum") or body.get("ntByngAmt"))
    profit_loss = _to_number(body.get("valPlSum") or body.get("valPl"))
    profit_rate = _to_number(body.get("valErnRSum") or body.get("valErnR"))
    return {
        "deposit": deposit,
        "total_eval": total_eval,
        "purchase_amount": purchase_amount,
        "eval_amount": eval_amount,
        "profit_loss": profit_loss,
        "profit_rate": profit_rate,
        "withdrawable_amount": _to_number(body.get("ndyOAmtPsblAmt")),
        "next_withdrawable_amount": _to_number(body.get("nxtNdyOAmtPsblAmt")),
        "margin_rate": _to_number(body.get("mrtgRt")),
    }


def _parse_balance_holdings(response: dict[str, Any]) -> list[dict[str, Any]]:
    holdings: list[dict[str, Any]] = []
    for record in _records(response):
        stock_code = str(record.get("isCd") or "").strip()
        stock_name = str(record.get("isNm") or "").strip()
        quantity = _to_int(record.get("hldQ"))
        if not stock_code and not stock_name and quantity == 0:
            continue
        holdings.append(
            {
                "stock_code": stock_code,
                "stock_name": stock_name,
                "quantity": quantity,
                "orderable_quantity": _to_int(record.get("ordrPsblQ")),
                "avg_price": _to_number(record.get("byngAvrPrc")),
                "current_price": _to_number(record.get("nowPrc")),
                "purchase_amount": _to_number(record.get("byngAmt")),
                "eval_amount": _to_number(record.get("valAmt")),
                "financing_amount": _to_number(record.get("fncngAmt")),
                "profit_loss": _to_number(record.get("valPl")),
                "profit_rate": _to_number(record.get("valErnR")),
                "currency": str(record.get("crncyCd") or "KRW").strip() or "KRW",
                "raw": mask_sensitive(record),
            }
        )
    return holdings

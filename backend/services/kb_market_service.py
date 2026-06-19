"""KB Securities B2C market-data access.

The OpenAPI developer project ships B2C XML/TR definitions for market data.  We
call those TRs directly through the KB OpenAPI proxy helper and normalize the
response shape used by the frontend:

- IVU10140: domestic stock current price
- IVU10070: domestic stock orderbook
- IVU10080: domestic intraday executions / time and sales
- GSS10030: overseas stock current price
- GSS10040: overseas stock orderbook
- GSA10020: overseas intraday executions / time and sales
"""

from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any

from fastapi import HTTPException

from backend.services.kb_openapi_service import call_kb_b2c_openapi


KB_DOMESTIC_CURRENT_PRICE_TR = "ivu10140"
KB_DOMESTIC_ORDERBOOK_TR = "ivu10070"
KB_DOMESTIC_EXECUTIONS_TR = "ivu10080"
KB_OVERSEAS_CURRENT_PRICE_TR = "gss10030"
KB_OVERSEAS_ORDERBOOK_TR = "gss10040"
KB_OVERSEAS_EXECUTIONS_TR = "gsa10020"
DEFAULT_ORDERBOOK_OVERTIME_MARKET_CLASS = "1"
DEFAULT_EXECUTION_COUNT = 10
DEFAULT_OVERSEAS_EXCHANGE_CODE = "NAS"
OVERSEAS_EXCHANGE_CODES = {
    "NAS": "NAS",
    "NASDAQ": "NAS",
    "NYS": "NYS",
    "NYSE": "NYS",
    "AMS": "AMS",
    "AMEX": "AMS",
}


class KBMarketServiceError(RuntimeError):
    """Raised when KB market-data lookup cannot be completed."""


async def get_kb_current_price(stock_code: str, env_dv: str = "real", exchange: str | None = None) -> dict[str, Any] | None:
    """Fetch and normalize current price data from KB Securities."""

    market = _resolve_market_identifier(stock_code, exchange)
    if market["is_domestic"]:
        raw = await _call_kb_b2c_tr(
            KB_DOMESTIC_CURRENT_PRICE_TR,
            {
                "excg_clsf": market["domestic_exchange_class"],
                "shrt_cd": market["stock_code"],
            },
        )
    else:
        raw = await _call_kb_b2c_tr(
            KB_OVERSEAS_CURRENT_PRICE_TR,
            {
                "krx_cd": market["krx_cd"],
                "is_cd": market["is_cd"],
            },
        )

    return _normalize_price_response(market["stock_code"], raw, market=market)


async def get_kb_orderbook(stock_code: str, env_dv: str = "real", exchange: str | None = None) -> dict[str, Any] | None:
    """Fetch and normalize 10-level orderbook data from KB Securities B2C."""

    market = _resolve_market_identifier(stock_code, exchange)
    if market["is_domestic"]:
        raw = await _call_kb_b2c_tr(
            KB_DOMESTIC_ORDERBOOK_TR,
            {
                "excg_clsf": market["domestic_exchange_class"],
                "is_cd": market["stock_code"],
                "ovtm_mkt_clsf": DEFAULT_ORDERBOOK_OVERTIME_MARKET_CLASS,
            },
        )
    else:
        raw = await _call_kb_b2c_tr(
            KB_OVERSEAS_ORDERBOOK_TR,
            {
                "krx_cd": market["krx_cd"],
                "is_cd": market["is_cd"],
            },
        )

    return _normalize_orderbook_response(market["stock_code"], raw, market=market)


async def get_kb_executions(
    stock_code: str,
    env_dv: str = "real",
    count: int = DEFAULT_EXECUTION_COUNT,
    exchange: str | None = None,
) -> dict[str, Any] | None:
    """Fetch and normalize time-and-sales execution data from KB Securities."""

    market = _resolve_market_identifier(stock_code, exchange)
    safe_count = max(1, min(int(count or DEFAULT_EXECUTION_COUNT), 50))
    if market["is_domestic"]:
        raw = await _call_kb_b2c_tr(
            KB_DOMESTIC_EXECUTIONS_TR,
            {
                "excg_clsf": market["domestic_exchange_class"],
                "is_cd": market["stock_code"],
                "ovtm_mkt_clsf": DEFAULT_ORDERBOOK_OVERTIME_MARKET_CLASS,
                "inq_cnt": str(safe_count),
            },
        )
    else:
        raw = await _call_kb_b2c_tr(
            KB_OVERSEAS_EXECUTIONS_TR,
            {
                "krx_cd": market["krx_cd"],
                "is_cd": market["is_cd"],
                "rcrd_c": str(safe_count),
            },
        )

    return _normalize_executions_response(market["stock_code"], raw, market=market)


async def _call_kb_b2c_tr(transaction_code: str, data_body: dict[str, Any]) -> dict[str, Any]:
    payload = {
        "dataHeader": _device_header(),
        "dataBody": data_body,
    }

    try:
        response = await call_kb_b2c_openapi("POST", f"/api/v1/{transaction_code}", payload)
    except HTTPException as exc:
        raise KBMarketServiceError(_http_exception_message(exc)) from exc
    except Exception as exc:
        raise KBMarketServiceError(f"KB B2C {transaction_code.upper()} call failed: {exc}") from exc

    parsed_body = _parse_kb_response_body(response.get("body"), transaction_code)
    if not response.get("ok"):
        message = _response_message(parsed_body) or f"HTTP {response.get('status')}"
        raise KBMarketServiceError(f"KB B2C {transaction_code.upper()} call failed: {message}")

    return parsed_body


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


def _normalize_price_response(stock_code: str, raw: Any, *, market: dict[str, Any] | None = None) -> dict[str, Any] | None:
    market = market or _resolve_market_identifier(stock_code)
    data = _first_dict_from_response(raw)
    price = _first_number(
        data,
        "price",
        "current_price",
        "currentPrice",
        "now_price",
        "now_prc",
        "now_prc_p4",
        "nowPrc",
        "stck_prpr",
        "trade_price",
        "prpr",
    )

    if price is None or price <= 0:
        return None

    change_sign = data.get("bdy_cmpr_ccd") or data.get("prdy_vrss_sign") or data.get("sign")
    change = _signed_by_compare_code(
        _first_number(data, "change", "price_change", "changePrice", "bdy_cmpr", "bdy_cmpr_p4", "prdy_vrss", "vs"),
        change_sign,
    )
    change_rate = _signed_by_compare_code(
        _first_number(data, "change_rate", "changeRate", "rate", "up_dwn_r_p2", "bdy_up_dwn_r_p2", "prdy_ctrt", "fltRt"),
        change_sign,
    )

    return {
        "stock_code": str(data.get("stock_code") or data.get("symbol") or stock_code),
        "stock_name": str(data.get("stock_name") or data.get("is_nm") or data.get("is_nm1") or ""),
        "price": price,
        "change": change or 0,
        "change_rate": change_rate or 0,
        "open": _first_number(data, "open", "open_price", "opn_prc", "opn_prc_p4", "stck_oprc"),
        "high": _first_number(data, "high", "high_price", "hgh_prc", "hgh_prc_p4", "stck_hgpr") or 0,
        "low": _first_number(data, "low", "low_price", "lw_prc", "lw_prc_p4", "stck_lwpr") or 0,
        "previous_close": _first_number(data, "previous_close", "prev_close", "bdy_cls_prc", "sprc_p4", "krx_bdy_clpr", "stck_sdpr"),
        "volume": int(_first_number(data, "volume", "acml_vlm", "acml_vol", "bdy_vlm", "vlm", "cntg_vol", "trde_qty") or 0),
        "trading_value": _first_number(data, "trading_value", "bdy_dl_tw_amt", "dl_tw_amt", "acml_tr_pbmn", "trde_prica"),
        "w52_high": _first_number(data, "w52_high", "dy250_max_prc", "wk52_max_prc_p4", "w52_hgpr", "hts_avls") or 0,
        "w52_low": _first_number(data, "w52_low", "dy250_min_prc", "wk52_min_prc_p4", "w52_lwpr") or 0,
        "margin_rate": _first_number(data, "margin_rate", "mrtgRt", "crdt_mgn_rt", "is_mgn_r_p4", "aplc_mgn_r_p4") or 0,
        "timestamp": str(data.get("timestamp") or data.get("datetime") or _market_timestamp(data) or datetime.now().isoformat()),
        "source": "kb_b2c" if market["is_domestic"] else "kb_b2c_overseas",
        "exchange": market.get("exchange"),
        "currency": _first_text(data.get("dl_crncy"), data.get("currency")) or ("KRW" if market["is_domestic"] else "USD"),
    }


def _normalize_orderbook_response(stock_code: str, raw: Any, *, market: dict[str, Any] | None = None) -> dict[str, Any] | None:
    market = market or _resolve_market_identifier(stock_code)
    data = _first_dict_from_response(raw)
    if not data:
        return None

    ask_prices = [
        _numeric_or_zero(_first_number(data, f"s{level}_aprc", f"s_askprc{level}_p4", f"ask_price_{level}"))
        for level in range(1, 11)
    ]
    bid_prices = [
        _numeric_or_zero(_first_number(data, f"b{level}_aprc", f"b_askprc{level}_p4", f"bid_price_{level}"))
        for level in range(1, 11)
    ]
    ask_volumes = [
        _number_or_zero(
            _first_raw_value(
                data,
                f"s_pstn_s{level}_aprc_q",
                f"b_pstn_s{level}_aprc_q",
                f"s_askprc_q{level}",
                f"ask_volume_{level}",
            )
        )
        for level in range(1, 11)
    ]
    bid_volumes = [
        _number_or_zero(
            _first_raw_value(
                data,
                f"b_pstn_b{level}_aprc_q",
                f"s_pstn_b{level}_aprc_q",
                f"b_askprc_q{level}",
                f"bid_volume_{level}",
            )
        )
        for level in range(1, 11)
    ]

    if not any(ask_prices) and not any(bid_prices):
        return None

    return {
        "stock_code": stock_code,
        "stock_name": str(data.get("stock_name") or data.get("is_nm") or data.get("is_nm1") or ""),
        "current_price": _numeric_or_zero(_first_number(data, "now_prc", "now_prc_p4", "sprc_p4")),
        "ask_prices": ask_prices,
        "ask_volumes": ask_volumes,
        "bid_prices": bid_prices,
        "bid_volumes": bid_volumes,
        "total_ask_volume": int(_first_number(data, "s_askprc_tl_q", "total_ask_volume") or sum(ask_volumes)),
        "total_bid_volume": int(_first_number(data, "b_askprc_tl_q", "total_bid_volume") or sum(bid_volumes)),
        "expected_price": _numeric_or_zero(_first_number(data, "expct_ccls_prc", "cas_expct_ccls_prc_p4")),
        "expected_volume": int(_number_or_zero(_first_raw_value(data, "expct_ccls_q", "cas_expct_ccls_q"))),
        "timestamp": _market_timestamp(data) or datetime.now().isoformat(),
        "source": "kb_b2c" if market["is_domestic"] else "kb_b2c_overseas",
        "exchange": market.get("exchange"),
        "currency": _first_text(data.get("dl_crncy"), data.get("currency")) or ("KRW" if market["is_domestic"] else "USD"),
    }


def _normalize_executions_response(stock_code: str, raw: Any, *, market: dict[str, Any] | None = None) -> dict[str, Any] | None:
    market = market or _resolve_market_identifier(stock_code)
    data = _data_body(raw)
    records = _record_list(data, "out", "out2", "records", "items", "list")
    if not records:
        records = _record_list(raw, "out", "out2", "records", "items", "list")

    executions = []
    for record in records:
        price = _first_number(record, "price", "ccls_prc", "now_prc", "now_prc_p4")
        quantity = _first_number(record, "quantity", "ccls_q", "cntg_vol")
        if price is None and quantity is None:
            continue
        compare_code = record.get("bdy_cmpr_ccd") or record.get("ccls_clsf")
        change = _signed_by_compare_code(_first_number(record, "change", "bdy_cmpr", "bdy_cmpr_p4"), compare_code) or 0
        executions.append(
            {
                "time": _format_time(str(_first_raw_value(record, "time", "ccls_tm", "tm", "kor_tm") or "")),
                "price": price or 0,
                "change": change,
                "change_rate": _signed_by_compare_code(_first_number(record, "change_rate", "up_dwn_r_p2", "bdy_up_dwn_r_p2"), compare_code) or 0,
                "quantity": int(quantity or 0),
                "side": _execution_side(record.get("sell_buy_ccd") or record.get("ccls_clsf")),
                "volume": int(_first_number(record, "volume", "acml_vlm", "vlm") or 0),
            }
        )

    return {
        "stock_code": stock_code,
        "executions": executions,
        "timestamp": datetime.now().isoformat(),
        "source": "kb_b2c" if market["is_domestic"] else "kb_b2c_overseas",
        "exchange": market.get("exchange"),
        "currency": _first_text(data.get("dl_crncy"), data.get("currency")) or ("KRW" if market["is_domestic"] else "USD"),
    }


def _first_dict(*values: Any) -> dict[str, Any]:
    for value in values:
        if isinstance(value, dict):
            return value
    return {}


def _first_dict_from_response(raw: Any) -> dict[str, Any]:
    data = _data_body(raw)
    return _first_dict(
        data.get("data"),
        data.get("output"),
        data.get("output1"),
        data.get("outblock"),
        data,
    )


def _data_body(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return {}
    data_body = raw.get("dataBody")
    if isinstance(data_body, dict):
        return data_body
    body = raw.get("body")
    if isinstance(body, dict):
        return body.get("dataBody") if isinstance(body.get("dataBody"), dict) else body
    return raw


def _record_list(data: Any, *keys: str) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if not isinstance(data, dict):
        return []
    for key in keys:
        value = data.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
        if isinstance(value, dict):
            values = list(value.values())
            if values and all(isinstance(item, dict) for item in values):
                return values
            return [value]
    return []


def _first_number(data: dict[str, Any], *keys: str) -> float | None:
    for key in keys:
        number = _to_number_for_key(key, data.get(key))
        if number is not None:
            return number
    return None


def _first_raw_value(data: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in data and data.get(key) not in (None, ""):
            return data.get(key)
    return None


def _first_text(*values: Any) -> str:
    for value in values:
        text = str(value or "").strip()
        if text:
            return text
    return ""


def _to_number(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int | float):
        return float(value)
    if isinstance(value, str):
        cleaned = re.sub(r"[^0-9.+-]", "", value)
        if not cleaned or cleaned in {"+", "-", ".", "+.", "-."}:
            return None
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def _to_number_for_key(key: str, value: Any) -> float | None:
    number = _to_number(value)
    if number is None:
        return None

    if not isinstance(value, str):
        return number

    cleaned = re.sub(r"[^0-9.+-]", "", value)
    if "." in cleaned:
        return number

    lower_key = key.lower()
    if lower_key.endswith("_p4") and len(cleaned.lstrip("+-")) > 4:
        return number / 10000
    if lower_key.endswith("_p2") and len(cleaned.lstrip("+-")) > 2:
        return number / 100
    return number


def _number_or_zero(value: Any) -> int:
    number = value if isinstance(value, int | float) and not isinstance(value, bool) else _to_number(value)
    return int(number or 0)


def _numeric_or_zero(value: Any) -> float:
    number = value if isinstance(value, int | float) and not isinstance(value, bool) else _to_number(value)
    return number or 0


def _signed_by_compare_code(value: float | None, code: Any) -> float | None:
    if value is None:
        return None
    text = str(code or "").strip().lower()
    if text in {"4", "5", "-", "down", "d", "sell"} and value > 0:
        return -value
    if text in {"1", "2", "+", "up", "u", "buy"} and value < 0:
        return abs(value)
    return value


def _execution_side(code: Any) -> str:
    text = str(code or "").strip()
    if text == "1":
        return "buy"
    if text == "2":
        return "sell"
    return "neutral"


def _format_time(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) >= 8:
        return f"{digits[:2]}:{digits[2:4]}:{digits[4:6]}"
    if len(digits) >= 6:
        return f"{digits[-6:-4]}:{digits[-4:-2]}:{digits[-2:]}"
    return value or "0"


def _resolve_market_identifier(stock_code: str, exchange: str | None = None) -> dict[str, Any]:
    code = _normalize_stock_code(stock_code)
    is_domestic = _is_domestic_stock_code(code) and not _is_overseas_exchange(exchange)
    exchange_code = _normalize_domestic_exchange_code(exchange) if is_domestic else _normalize_overseas_exchange_code(exchange)
    return {
        "stock_code": code,
        "is_cd": code,
        "krx_cd": exchange_code,
        "exchange": exchange_code,
        "is_domestic": is_domestic,
        "domestic_exchange_class": _domestic_exchange_class(exchange_code) if is_domestic else "",
    }


def _is_domestic_stock_code(stock_code: str) -> bool:
    return bool(re.fullmatch(r"\d{6}", stock_code))


def _is_overseas_exchange(exchange: str | None) -> bool:
    normalized = re.sub(r"[^0-9A-Za-z]", "", str(exchange or "")).upper()
    if not normalized:
        return False
    return not _is_domestic_exchange_code(normalized)


def _normalize_overseas_exchange_code(exchange: str | None) -> str:
    normalized = re.sub(r"[^0-9A-Za-z]", "", str(exchange or "")).upper()
    if not normalized or _is_domestic_exchange_code(normalized):
        return DEFAULT_OVERSEAS_EXCHANGE_CODE
    return OVERSEAS_EXCHANGE_CODES.get(normalized, normalized[:3])


def _is_domestic_exchange_code(normalized_exchange: str) -> bool:
    return normalized_exchange in {"KR", "KOR", "KRX", "KOSPI", "KOSDAQ", "NXT", "KRXNXT", "NXTKRX", "SOR", "ALL", "ATS"} or "NXT" in normalized_exchange


def _normalize_domestic_exchange_code(exchange: str | None) -> str:
    normalized = re.sub(r"[^0-9A-Za-z]", "", str(exchange or "")).upper()
    if "NXT" in normalized:
        return "NXT"
    if normalized in {"SOR", "ALL", "ATS"}:
        return "ALL"
    return "KRX"


def _domestic_exchange_class(exchange: str | None) -> str:
    normalized = _normalize_domestic_exchange_code(exchange)
    if normalized == "NXT":
        return "2"
    if normalized == "ALL":
        return "0"
    return "1"


def _market_timestamp(data: dict[str, Any]) -> str:
    date_value = _first_text(data.get("kor_dt"), data.get("dt"), data.get("bsnss_dt"))
    time_value = _first_text(data.get("kor_tm"), data.get("tm"))
    if date_value and time_value:
        return f"{date_value}T{_format_time(time_value)}"
    return ""


def _normalize_stock_code(stock_code: str) -> str:
    normalized = re.sub(r"[^0-9A-Za-z.-]", "", str(stock_code or "")).upper()
    if normalized.startswith("A") and normalized[1:].isdigit():
        normalized = normalized[1:]
    if normalized.isdigit():
        normalized = normalized.zfill(6)
    if not normalized:
        raise KBMarketServiceError("Stock code is required for KB B2C market data.")
    return normalized


def _parse_kb_response_body(body: Any, transaction_code: str) -> dict[str, Any]:
    if isinstance(body, dict):
        return body
    if not isinstance(body, str) or not body.strip():
        raise KBMarketServiceError(f"KB B2C {transaction_code.upper()} returned an empty response.")
    try:
        parsed = json.loads(body)
    except ValueError as exc:
        raise KBMarketServiceError(f"KB B2C {transaction_code.upper()} returned a non-JSON response.") from exc
    if not isinstance(parsed, dict):
        raise KBMarketServiceError(f"KB B2C {transaction_code.upper()} returned an unsupported response.")
    return parsed


def _response_message(body: dict[str, Any]) -> str | None:
    data_header = body.get("dataHeader") if isinstance(body.get("dataHeader"), dict) else {}
    data_body = body.get("dataBody") if isinstance(body.get("dataBody"), dict) else {}
    for source in (data_header, data_body, body):
        for key in ("message", "msg", "rsp_msg", "error", "error_description"):
            value = source.get(key) if isinstance(source, dict) else None
            if value:
                return str(value)
    return None


def _http_exception_message(exc: HTTPException) -> str:
    detail = exc.detail
    if isinstance(detail, str):
        return detail
    if isinstance(detail, dict):
        return str(detail.get("message") or detail.get("detail") or "KB B2C OpenAPI request failed.")
    return "KB B2C OpenAPI request failed."

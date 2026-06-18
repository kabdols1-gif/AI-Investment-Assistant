"""KB Securities market-data access.

REST quote lookup is intentionally routed through the KB data fetcher. The
exact KB quote endpoint mapping still lives behind ``core.data_fetcher``; when
that mapping is absent we raise a typed error so callers can keep displaying
zeroes instead of falling back to mock prices or another broker.
"""

from __future__ import annotations

import asyncio
import re
from datetime import datetime
from typing import Any

from core import data_fetcher


class KBMarketServiceError(RuntimeError):
    """Raised when KB market-data lookup cannot be completed."""


async def get_kb_current_price(stock_code: str, env_dv: str = "real") -> dict[str, Any] | None:
    """Fetch and normalize current price data from KB Securities."""

    try:
        raw = await asyncio.to_thread(data_fetcher.get_current_price, stock_code, env_dv)
    except NotImplementedError as exc:
        raise KBMarketServiceError(str(exc)) from exc
    except Exception as exc:
        raise KBMarketServiceError(f"KB current price lookup failed: {exc}") from exc

    return _normalize_price_response(stock_code, raw)


def _normalize_price_response(stock_code: str, raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None

    data = _first_dict(raw.get("data"), raw.get("output"), raw.get("output1"), raw)
    price = _first_number(
        data,
        "price",
        "current_price",
        "currentPrice",
        "now_price",
        "nowPrc",
        "stck_prpr",
        "trade_price",
        "prpr",
    )

    if price is None or price <= 0:
        return None

    return {
        "stock_code": str(data.get("stock_code") or data.get("symbol") or stock_code),
        "price": price,
        "change": _first_number(data, "change", "price_change", "changePrice", "prdy_vrss", "vs") or 0,
        "change_rate": _first_number(data, "change_rate", "changeRate", "rate", "prdy_ctrt", "fltRt") or 0,
        "open": _first_number(data, "open", "open_price", "stck_oprc"),
        "high": _first_number(data, "high", "high_price", "stck_hgpr") or 0,
        "low": _first_number(data, "low", "low_price", "stck_lwpr") or 0,
        "previous_close": _first_number(data, "previous_close", "prev_close", "stck_sdpr"),
        "volume": int(_first_number(data, "volume", "acml_vol", "cntg_vol", "trde_qty") or 0),
        "trading_value": _first_number(data, "trading_value", "acml_tr_pbmn", "trde_prica"),
        "w52_high": _first_number(data, "w52_high", "w52_hgpr", "hts_avls") or 0,
        "w52_low": _first_number(data, "w52_low", "w52_lwpr") or 0,
        "timestamp": str(data.get("timestamp") or data.get("datetime") or datetime.now().isoformat()),
        "source": "kb",
    }


def _first_dict(*values: Any) -> dict[str, Any]:
    for value in values:
        if isinstance(value, dict):
            return value
    return {}


def _first_number(data: dict[str, Any], *keys: str) -> float | None:
    for key in keys:
        number = _to_number(data.get(key))
        if number is not None:
            return number
    return None


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

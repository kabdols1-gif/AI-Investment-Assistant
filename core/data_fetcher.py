"""KB market/account data access placeholders.

The legacy market-data implementation was intentionally removed from this copy.  Authentication
is available through ``kb_auth``; market, holdings, buyable, pending-order, and
cancel endpoints still need KB API mappings.
"""

from __future__ import annotations

import pandas as pd


def _not_implemented(name: str):
    raise NotImplementedError(f"KB {name} API is not implemented yet.")


def clear_balance_cache():
    return None


def get_daily_prices(
    stock_code: str,
    period: str = "D",
    count: int = 120,
    env_dv: str = "real",
) -> pd.DataFrame:
    _not_implemented("daily prices")


def get_current_price(stock_code: str, env_dv: str = "real") -> dict:
    _not_implemented("current price")


def get_holdings(env_dv: str = "real") -> pd.DataFrame:
    _not_implemented("holdings")


def get_buyable_amount(stock_code: str, price: int = 0, env_dv: str = "real") -> dict:
    _not_implemented("buyable amount")


def get_deposit(env_dv: str = "real") -> dict:
    _not_implemented("deposit")


def get_orderbook(stock_code: str, env_dv: str = "real") -> dict:
    _not_implemented("orderbook")


def get_pending_orders(env_dv: str = "real") -> tuple[pd.DataFrame, bool]:
    _not_implemented("pending orders")


def cancel_order(
    order_no: str,
    org_no: str,
    stock_code: str,
    qty: int,
    env_dv: str = "real",
) -> pd.DataFrame:
    _not_implemented("cancel order")

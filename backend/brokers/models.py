"""Normalized broker models used by UI and services."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


BrokerMode = Literal["paper", "live"]
OrderSide = Literal["buy", "sell"]
OrderType = Literal["market", "limit", "conditional"]


class BrokerCapabilities(BaseModel):
    broker: str
    broker_name: str
    configured: bool = False
    quote: bool = False
    orderbook: bool = False
    daily_bars: bool = False
    balance: bool = False
    holdings: bool = False
    buyable_amount: bool = False
    place_order: bool = False
    cancel_order: bool = False
    websocket: bool = False
    message: str = ""


class AuthStatus(BaseModel):
    broker: str
    status: Literal["success", "missing", "failed", "not_configured"]
    message: str
    token_received: bool = False
    raw: dict[str, Any] = Field(default_factory=dict)


class Quote(BaseModel):
    broker: str
    symbol: str
    name: str | None = None
    market: str = "KR"
    price: float | None = None
    change: float | None = None
    change_rate: float | None = None
    volume: int | None = None
    trading_value: float | None = None
    timestamp: str | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class OrderBookLevel(BaseModel):
    price: float
    ask_quantity: int | None = None
    bid_quantity: int | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class OrderBook(BaseModel):
    broker: str
    symbol: str
    market: str = "KR"
    levels: list[OrderBookLevel] = Field(default_factory=list)
    timestamp: str | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class DailyBar(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: int | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class BalanceSummary(BaseModel):
    broker: str
    cash: float | None = None
    total_asset: float | None = None
    purchase_amount: float | None = None
    evaluation_amount: float | None = None
    profit_loss: float | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class Holding(BaseModel):
    broker: str
    symbol: str
    name: str | None = None
    quantity: int
    average_price: float | None = None
    evaluation_amount: float | None = None
    profit_loss: float | None = None
    profit_rate: float | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class BuyableAmount(BaseModel):
    broker: str
    symbol: str
    price: float | None = None
    amount: float | None = None
    quantity: int | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class OrderRequest(BaseModel):
    broker: str
    symbol: str
    name: str | None = None
    side: OrderSide
    order_type: OrderType = "limit"
    quantity: int
    price: float | None = None
    mode: BrokerMode = "paper"
    user_confirmed: bool = False
    raw: dict[str, Any] = Field(default_factory=dict)


class OrderResult(BaseModel):
    broker: str
    status: Literal["blocked", "preview", "submitted", "failed"]
    message: str
    order_no: str | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class CancelOrderRequest(BaseModel):
    broker: str
    order_no: str
    symbol: str
    quantity: int
    mode: BrokerMode = "paper"
    user_confirmed: bool = False
    raw: dict[str, Any] = Field(default_factory=dict)


class CancelOrderResult(BaseModel):
    broker: str
    status: Literal["blocked", "submitted", "failed"]
    message: str
    order_no: str | None = None
    raw: dict[str, Any] = Field(default_factory=dict)

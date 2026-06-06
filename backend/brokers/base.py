"""Common broker adapter interface."""

from __future__ import annotations

from abc import ABC, abstractmethod

from backend.brokers.models import (
    AuthStatus,
    BalanceSummary,
    BrokerCapabilities,
    BuyableAmount,
    CancelOrderRequest,
    CancelOrderResult,
    DailyBar,
    Holding,
    OrderBook,
    OrderRequest,
    OrderResult,
    Quote,
)


class BrokerAdapter(ABC):
    broker_id: str
    broker_name: str

    @abstractmethod
    async def get_capabilities(self) -> BrokerCapabilities: ...

    @abstractmethod
    async def test_connection(self) -> AuthStatus: ...

    @abstractmethod
    async def get_access_token(self, force_refresh: bool = False) -> AuthStatus: ...

    @abstractmethod
    async def get_quote(self, symbol: str, market: str = "KR") -> Quote: ...

    @abstractmethod
    async def get_orderbook(self, symbol: str, market: str = "KR") -> OrderBook: ...

    @abstractmethod
    async def get_daily_bars(self, symbol: str, market: str = "KR", period: str = "D", count: int = 120) -> list[DailyBar]: ...

    @abstractmethod
    async def get_balance(self) -> BalanceSummary: ...

    @abstractmethod
    async def get_holdings(self) -> list[Holding]: ...

    @abstractmethod
    async def get_buyable_amount(self, symbol: str, price: int | None = None) -> BuyableAmount: ...

    @abstractmethod
    async def place_order(self, request: OrderRequest) -> OrderResult: ...

    @abstractmethod
    async def cancel_order(self, request: CancelOrderRequest) -> CancelOrderResult: ...

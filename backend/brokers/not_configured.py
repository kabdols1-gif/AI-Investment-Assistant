"""Base adapter for brokers whose official endpoint mapping is not configured."""

from __future__ import annotations

from backend.brokers.base import BrokerAdapter
from backend.brokers.errors import NotConfiguredError
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


class NotConfiguredBrokerAdapter(BrokerAdapter):
    broker_id = "not_configured"
    broker_name = "Not Configured"

    async def get_capabilities(self) -> BrokerCapabilities:
        return BrokerCapabilities(
            broker=self.broker_id,
            broker_name=self.broker_name,
            configured=False,
            message="공식 endpoint mapping이 아직 설정되지 않았습니다.",
        )

    async def test_connection(self) -> AuthStatus:
        return AuthStatus(
            broker=self.broker_id,
            status="not_configured",
            message=f"config/brokers/{self.broker_id}/endpoints.yaml mapping이 필요합니다.",
        )

    async def get_access_token(self, force_refresh: bool = False) -> AuthStatus:
        raise NotConfiguredError(self.broker_id, "auth.token")

    async def get_quote(self, symbol: str, market: str = "KR") -> Quote:
        raise NotConfiguredError(self.broker_id, "quote")

    async def get_orderbook(self, symbol: str, market: str = "KR") -> OrderBook:
        raise NotConfiguredError(self.broker_id, "orderbook")

    async def get_daily_bars(self, symbol: str, market: str = "KR", period: str = "D", count: int = 120) -> list[DailyBar]:
        raise NotConfiguredError(self.broker_id, "daily_bars")

    async def get_balance(self) -> BalanceSummary:
        raise NotConfiguredError(self.broker_id, "balance")

    async def get_holdings(self) -> list[Holding]:
        raise NotConfiguredError(self.broker_id, "holdings")

    async def get_buyable_amount(self, symbol: str, price: int | None = None) -> BuyableAmount:
        raise NotConfiguredError(self.broker_id, "buyable_amount")

    async def place_order(self, request: OrderRequest) -> OrderResult:
        raise NotConfiguredError(self.broker_id, "place_order")

    async def cancel_order(self, request: CancelOrderRequest) -> CancelOrderResult:
        raise NotConfiguredError(self.broker_id, "cancel_order")

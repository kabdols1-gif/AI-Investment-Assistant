"""Explicit mock broker adapter for UI development and dry-run tests."""

from __future__ import annotations

from datetime import date

from backend.brokers.base import BrokerAdapter
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
    OrderBookLevel,
    OrderRequest,
    OrderResult,
    Quote,
)


class MockBrokerAdapter(BrokerAdapter):
    broker_id = "mock"
    broker_name = "Mock Broker"

    async def get_capabilities(self) -> BrokerCapabilities:
        return BrokerCapabilities(
            broker=self.broker_id,
            broker_name=self.broker_name,
            configured=True,
            quote=True,
            orderbook=True,
            daily_bars=True,
            balance=True,
            holdings=True,
            buyable_amount=True,
            place_order=True,
            cancel_order=True,
            message="명시적으로 선택한 mock adapter입니다. 실전 주문을 제출하지 않습니다.",
        )

    async def test_connection(self) -> AuthStatus:
        return AuthStatus(broker=self.broker_id, status="success", message="mock adapter ready", token_received=False)

    async def get_access_token(self, force_refresh: bool = False) -> AuthStatus:
        return AuthStatus(broker=self.broker_id, status="success", message="mock token not required", token_received=False)

    async def get_quote(self, symbol: str, market: str = "KR") -> Quote:
        return Quote(
            broker=self.broker_id,
            symbol=symbol,
            name="삼성전자" if symbol == "005930" else None,
            market=market,
            price=66200,
            change=-1030,
            change_rate=-1.53,
            volume=11683393,
            trading_value=772104000000,
            timestamp=date.today().isoformat(),
            raw={"source": "mock"},
        )

    async def get_orderbook(self, symbol: str, market: str = "KR") -> OrderBook:
        return OrderBook(
            broker=self.broker_id,
            symbol=symbol,
            market=market,
            levels=[
                OrderBookLevel(price=66250, ask_quantity=52303, raw={"source": "mock"}),
                OrderBookLevel(price=66200, ask_quantity=21108, bid_quantity=552, raw={"source": "mock"}),
                OrderBookLevel(price=66150, bid_quantity=269, raw={"source": "mock"}),
            ],
            timestamp=date.today().isoformat(),
            raw={"source": "mock"},
        )

    async def get_daily_bars(self, symbol: str, market: str = "KR", period: str = "D", count: int = 120) -> list[DailyBar]:
        return [
            DailyBar(date="2026-06-03", open=65900, high=67200, low=65500, close=66700, volume=13200000, raw={"source": "mock"}),
            DailyBar(date="2026-06-04", open=66700, high=67300, low=65900, close=66200, volume=11683393, raw={"source": "mock"}),
        ]

    async def get_balance(self) -> BalanceSummary:
        return BalanceSummary(
            broker=self.broker_id,
            cash=123000000,
            total_asset=128450000,
            raw={"source": "mock"},
        )

    async def get_holdings(self) -> list[Holding]:
        return [
            Holding(
                broker=self.broker_id,
                symbol="005930",
                name="삼성전자",
                quantity=120,
                average_price=64800,
                evaluation_amount=7944000,
                profit_rate=2.16,
                raw={"source": "mock"},
            )
        ]

    async def get_buyable_amount(self, symbol: str, price: int | None = None) -> BuyableAmount:
        return BuyableAmount(broker=self.broker_id, symbol=symbol, price=price, amount=123000000, quantity=1858, raw={"source": "mock"})

    async def place_order(self, request: OrderRequest) -> OrderResult:
        return OrderResult(
            broker=self.broker_id,
            status="preview",
            message="mock dry-run 주문 후보입니다. 실전 주문은 제출되지 않았습니다.",
            raw={"source": "mock", "request": request.model_dump()},
        )

    async def cancel_order(self, request: CancelOrderRequest) -> CancelOrderResult:
        return CancelOrderResult(
            broker=self.broker_id,
            status="blocked",
            message="mock adapter는 실제 취소 주문을 제출하지 않습니다.",
            order_no=request.order_no,
            raw={"source": "mock"},
        )

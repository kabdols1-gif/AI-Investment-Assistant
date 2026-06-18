"""Orderbook WebSocket manager.

KB B2C does not provide a dedicated orderbook WebSocket in this app yet, so we
poll the KB B2C orderbook TR and fan out snapshots to subscribed clients.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any

from backend.services.kb_market_service import KBMarketServiceError, get_kb_orderbook


logging.basicConfig(level=logging.INFO)

ORDERBOOK_POLL_INTERVAL_SECONDS = 3


class OrderbookWebSocketManager:
    """Manage orderbook snapshot subscriptions."""

    def __init__(self) -> None:
        self.subscriptions: dict[str, set[Any]] = {}
        self.running = False
        self.polling_tasks: dict[str, asyncio.Task] = {}

    async def start(self) -> None:
        if self.running:
            return
        self.running = True
        logging.info("Orderbook WebSocket manager started")

    async def stop(self) -> None:
        self.running = False
        for task in self.polling_tasks.values():
            task.cancel()
        self.polling_tasks.clear()
        self.subscriptions.clear()
        logging.info("Orderbook WebSocket manager stopped")

    async def subscribe_orderbook(self, stock_code: str, client_ws: Any) -> None:
        if stock_code not in self.subscriptions:
            self.subscriptions[stock_code] = set()
            self.polling_tasks[stock_code] = asyncio.create_task(self._polling_loop(stock_code))
            logging.info("Orderbook polling started: %s", stock_code)

        self.subscriptions[stock_code].add(client_ws)
        logging.info("Orderbook client added: %s (%d)", stock_code, len(self.subscriptions[stock_code]))

    async def unsubscribe_orderbook(self, stock_code: str, client_ws: Any) -> None:
        if stock_code not in self.subscriptions:
            return

        self.subscriptions[stock_code].discard(client_ws)
        logging.info("Orderbook client removed: %s (%d)", stock_code, len(self.subscriptions[stock_code]))

        if not self.subscriptions[stock_code]:
            task = self.polling_tasks.pop(stock_code, None)
            if task:
                task.cancel()
            del self.subscriptions[stock_code]
            logging.info("Orderbook polling stopped: %s", stock_code)

    async def _polling_loop(self, stock_code: str) -> None:
        while self.running and stock_code in self.subscriptions:
            try:
                orderbook = await get_kb_orderbook(stock_code, env_dv="real")
                if orderbook:
                    payload = {
                        "type": "orderbook",
                        "stock_code": stock_code,
                        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "data": {
                            "current_price": orderbook.get("current_price"),
                            "ask_prices": orderbook.get("ask_prices", []),
                            "ask_volumes": orderbook.get("ask_volumes", []),
                            "bid_prices": orderbook.get("bid_prices", []),
                            "bid_volumes": orderbook.get("bid_volumes", []),
                            "total_ask_volume": orderbook.get("total_ask_volume", 0),
                            "total_bid_volume": orderbook.get("total_bid_volume", 0),
                            "expected_price": orderbook.get("expected_price", 0),
                            "expected_volume": orderbook.get("expected_volume", 0),
                            "source": orderbook.get("source", "kb_b2c"),
                        },
                    }

                    clients = list(self.subscriptions.get(stock_code, []))
                    for client_ws in clients:
                        try:
                            await client_ws.send_json(payload)
                        except Exception as exc:
                            logging.error("Orderbook client send failed: %s", exc)
                            await self.unsubscribe_orderbook(stock_code, client_ws)

                await asyncio.sleep(ORDERBOOK_POLL_INTERVAL_SECONDS)
            except asyncio.CancelledError:
                break
            except KBMarketServiceError as exc:
                logging.error("KB orderbook polling failed (%s): %s", stock_code, exc)
                await asyncio.sleep(ORDERBOOK_POLL_INTERVAL_SECONDS)
            except Exception as exc:
                logging.error("Orderbook polling failed (%s): %s", stock_code, exc)
                await asyncio.sleep(ORDERBOOK_POLL_INTERVAL_SECONDS)


_ws_manager: OrderbookWebSocketManager | None = None


def get_ws_manager() -> OrderbookWebSocketManager:
    global _ws_manager

    if _ws_manager is None:
        _ws_manager = OrderbookWebSocketManager()

    return _ws_manager

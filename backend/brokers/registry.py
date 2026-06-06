"""Broker adapter registry."""

from __future__ import annotations

from backend.brokers.base import BrokerAdapter
from backend.brokers.errors import NotConfiguredError
from backend.brokers.kb.adapter import KBBrokerAdapter
from backend.brokers.kis.adapter import KISBrokerAdapter
from backend.brokers.kiwoom.adapter import KiwoomBrokerAdapter
from backend.brokers.ls.adapter import LSBrokerAdapter
from backend.brokers.mock.adapter import MockBrokerAdapter


_ADAPTERS: dict[str, type[BrokerAdapter]] = {
    "mock": MockBrokerAdapter,
    "kb": KBBrokerAdapter,
    "kis": KISBrokerAdapter,
    "korea_investment": KISBrokerAdapter,
    "ls": LSBrokerAdapter,
    "kiwoom": KiwoomBrokerAdapter,
}


def list_broker_adapters() -> list[dict[str, str]]:
    return [
        {"broker": broker_id, "adapter": adapter_class.__name__, "name": adapter_class.broker_name}
        for broker_id, adapter_class in sorted(_ADAPTERS.items())
    ]


def get_broker_adapter(broker_id: str) -> BrokerAdapter:
    adapter_class = _ADAPTERS.get(broker_id)
    if not adapter_class:
        raise NotConfiguredError(broker_id, "adapter")
    return adapter_class()

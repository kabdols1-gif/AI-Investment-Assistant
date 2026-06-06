import asyncio

import pytest

from backend.brokers.errors import NotConfiguredError
from backend.brokers.registry import get_broker_adapter, list_broker_adapters


def test_broker_registry_lists_supported_adapters():
    brokers = {item["broker"] for item in list_broker_adapters()}

    assert {"mock", "kb", "kis", "korea_investment", "ls", "kiwoom"} <= brokers


def test_unmapped_broker_returns_not_configured():
    with pytest.raises(NotConfiguredError) as exc_info:
        get_broker_adapter("unknown_broker")

    assert exc_info.value.to_response()["status"] == "not_configured"


def test_unconfigured_adapter_blocks_quote_calls():
    adapter = get_broker_adapter("kb")

    with pytest.raises(NotConfiguredError) as exc_info:
        asyncio.run(adapter.get_quote("005930"))

    response = exc_info.value.to_response()
    assert response["status"] == "not_configured"
    assert response["broker"] == "kb"
    assert response["feature"] == "quote"


def test_mock_adapter_is_explicit_and_never_submits_live_order():
    adapter = get_broker_adapter("mock")
    quote = asyncio.run(adapter.get_quote("005930"))

    assert quote.raw["source"] == "mock"
    assert quote.symbol == "005930"

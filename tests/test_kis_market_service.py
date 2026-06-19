import backend.services.kis_market_service as kis_market_service
from backend.services.openapi_runtime import get_runtime_settings, load_openapi_key_defaults


def _clear_runtime_caches():
    get_runtime_settings.cache_clear()
    load_openapi_key_defaults.cache_clear()


def test_kis_credentials_can_load_from_openapi_runtime(monkeypatch):
    monkeypatch.setenv("AIS_OPENAPI_MODE", "development")
    monkeypatch.setenv("AIS_OPENAPI_KIS_REAL_CLIENT_ID", "REAL_KIS_CLIENT")
    monkeypatch.setenv("AIS_OPENAPI_KIS_REAL_CLIENT_SECRET", "REAL_KIS_SECRET")
    _clear_runtime_caches()

    credentials = kis_market_service._load_kis_credentials(live=True)

    assert credentials["client_id"] == "REAL_KIS_CLIENT"
    assert credentials["client_secret"] == "REAL_KIS_SECRET"


def test_kis_realtime_stock_codes_are_normalized():
    assert kis_market_service._normalize_realtime_stock_codes(["A005930", "005930", "660", "NVDA", ""]) == [
        "005930",
        "000660",
    ]


def test_kis_realtime_subscribe_payload_uses_trade_tr_id():
    payload = kis_market_service._realtime_subscribe_payload("APPROVAL", "005930")

    assert payload["header"]["approval_key"] == "APPROVAL"
    assert payload["body"]["input"] == {
        "tr_id": kis_market_service.KIS_REALTIME_TRADE_TR_ID,
        "tr_key": "005930",
    }


def test_kis_realtime_subscribe_payload_can_use_nxt_trade_tr_id():
    payload = kis_market_service._realtime_subscribe_payload(
        "APPROVAL",
        "005930",
        tr_id=kis_market_service.KIS_NXT_REALTIME_TRADE_TR_ID,
    )

    assert payload["body"]["input"] == {
        "tr_id": kis_market_service.KIS_NXT_REALTIME_TRADE_TR_ID,
        "tr_key": "005930",
    }


def test_kis_realtime_trade_message_accepts_nxt_tr_id():
    message = "0|H0NXCNT0|001|005930^093000^65000^2^1200^1.88^0^64100^65500^63800^65100^64900^0^12345678^803000000000"

    parsed = kis_market_service.parse_kis_realtime_trade_message(
        message,
        allowed_tr_ids={kis_market_service.KIS_NXT_REALTIME_TRADE_TR_ID},
        exchange="NXT",
    )

    assert parsed is not None
    assert parsed["stock_code"] == "005930"
    assert parsed["price"] == 65000
    assert parsed["change"] == 1200
    assert parsed["change_rate"] == 1.88
    assert parsed["exchange"] == "NXT"
    assert parsed["currency"] == "KRW"

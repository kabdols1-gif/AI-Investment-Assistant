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

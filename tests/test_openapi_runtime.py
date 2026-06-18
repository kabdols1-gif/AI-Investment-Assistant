from backend.services import secure_config
from backend.services.openapi_runtime import get_runtime_settings, load_openapi_key_defaults, load_openapi_kis_credentials


def _clear_runtime_caches():
    get_runtime_settings.cache_clear()
    load_openapi_key_defaults.cache_clear()


def test_development_runtime_applies_openapi_b2c_credentials(monkeypatch):
    monkeypatch.setenv("AIS_OPENAPI_MODE", "development")
    monkeypatch.setenv("AIS_OPENAPI_B2C_CLIENT_ID", "DEV_B2C_CLIENT")
    monkeypatch.setenv("AIS_OPENAPI_B2C_CLIENT_SECRET", "DEV_B2C_SECRET")
    _clear_runtime_caches()

    status = secure_config.config_status(
        {
            "kb": {
                "broker": "kb",
                "api_key": "",
                "api_secret": "",
                "account": "",
                "product_code": "",
                "base_url": "https://dbaasapi.kbsec.com:32484",
            }
        }
    )

    assert status.runtime_mode == "development"
    assert status.kb_base_url == "https://ddeveloper.kbsec.com:32484"
    assert status.kb_key_registered is True
    assert status.kb_secret_registered is True
    assert status.kb_credential_source == "environment"


def test_production_runtime_uses_production_b2c_defaults(monkeypatch):
    monkeypatch.setenv("AIS_OPENAPI_MODE", "production")
    _clear_runtime_caches()

    status = secure_config.config_status(
        {
            "kb": {
                "broker": "kb",
                "api_key": "",
                "api_secret": "",
                "account": "",
                "product_code": "",
                "base_url": "",
            }
        }
    )

    assert status.runtime_mode == "production"
    assert status.kb_base_url == "https://developer.kbsec.com"
    assert status.kb_credential_source == "missing"


def test_kis_real_credentials_load_from_environment(monkeypatch):
    monkeypatch.setenv("AIS_OPENAPI_MODE", "production")
    monkeypatch.setenv("AIS_OPENAPI_KIS_REAL_CLIENT_ID", "KIS_REAL_CLIENT")
    monkeypatch.setenv("AIS_OPENAPI_KIS_REAL_CLIENT_SECRET", "KIS_REAL_SECRET")
    _clear_runtime_caches()

    credentials = load_openapi_kis_credentials(live=True)

    assert credentials["client_id"] == "KIS_REAL_CLIENT"
    assert credentials["client_secret"] == "KIS_REAL_SECRET"
    assert credentials["mode"] == "real"
    assert credentials["source"] == "environment"

import json
from collections import namedtuple

import backend.services.kb_account_service as kb_account_service
from backend.services.kb_account_service import (
    KBAccountServiceError,
    KBB2BOpenApiTransport,
    _decrypt_ecb_pkcs7,
    _encrypt_ecb_pkcs7,
    _ensure_b2b_account_token,
    _is_auth_failure_response,
    _parse_balance_holdings,
    _parse_balance_summary,
    _raise_if_kb_business_error,
    _parse_saqm9006_accounts,
    _select_single_comprehensive_account,
)


def test_saqm9006_selects_single_comprehensive_account():
    response = {
        "dataBody": {
            "Record1": [
                {"account": "100000001", "stockNo": "01", "stockName": "Other"},
                {
                    "account": "200000001",
                    "stockNo": "01",
                    "stockName": "Comprehensive",
                    "accountName": "Main Account",
                },
            ]
        }
    }

    accounts = _parse_saqm9006_accounts(response)
    selected = _select_single_comprehensive_account(accounts, {"product_code": "01"})

    assert selected.account_no == "200000001"
    assert selected.product_code == "01"
    assert selected.account_name == "Main Account"


def test_ssqm2952_balance_response_is_normalized():
    response = {
        "dataBody": {
            "dyTfnd": "1,000,000",
            "ntAstsValAmt": "3,500,000",
            "byngAmtSum": "2,000,000",
            "valAmtSum": "2,500,000",
            "valPlSum": "500,000",
            "valErnRSum": "25.00",
            "Record1": [
                {
                    "isCd": "005930",
                    "isNm": "Samsung Electronics",
                    "hldQ": "10",
                    "ordrPsblQ": "8",
                    "byngAvrPrc": "60000",
                    "nowPrc": "65000",
                    "byngAmt": "600000",
                    "valAmt": "650000",
                    "valPl": "50000",
                    "valErnR": "8.33",
                }
            ],
        }
    }

    summary = _parse_balance_summary(response)
    holdings = _parse_balance_holdings(response)

    assert summary["deposit"] == 1_000_000
    assert summary["total_eval"] == 3_500_000
    assert summary["purchase_amount"] == 2_000_000
    assert summary["eval_amount"] == 2_500_000
    assert summary["profit_loss"] == 500_000
    assert summary["profit_rate"] == 25.0
    assert holdings == [
        {
            "stock_code": "005930",
            "stock_name": "Samsung Electronics",
            "quantity": 10,
            "orderable_quantity": 8,
            "avg_price": 60000.0,
            "current_price": 65000.0,
            "purchase_amount": 600000.0,
            "eval_amount": 650000.0,
            "financing_amount": 0.0,
            "profit_loss": 50000.0,
            "profit_rate": 8.33,
            "currency": "KRW",
            "raw": {
                "isCd": "005930",
                "isNm": "Samsung Electronics",
                "hldQ": "10",
                "ordrPsblQ": "8",
                "byngAvrPrc": "60000",
                "nowPrc": "65000",
                "byngAmt": "600000",
                "valAmt": "650000",
                "valPl": "50000",
                "valErnR": "8.33",
            },
        }
    ]


def test_kb_b2b_aes_ecb_round_trip():
    secret = "12345678901234567890123456789012"
    plain = '{"dataHeader":{"udId":"UDID"},"dataBody":{"gnlAcNo":"200000001"}}'

    encrypted = _encrypt_ecb_pkcs7(secret, plain)
    decrypted = _decrypt_ecb_pkcs7(secret, encrypted)

    assert decrypted == plain


def test_kb_business_error_message_raises():
    response = {"dataBody": {"oMsg": "계좌비밀번호 1회 오류입니다."}}

    try:
        _raise_if_kb_business_error("SSQM2952", response)
    except KBAccountServiceError as exc:
        assert "SSQM2952" in str(exc)
        assert "계좌비밀번호" in str(exc)
    else:
        raise AssertionError("Expected KBAccountServiceError")


def test_auth_failure_response_detects_missing_or_expired_token():
    assert _is_auth_failure_response(401, {"message": "Unauthorized"})
    assert _is_auth_failure_response(200, {"dataBody": {"oMsg": "접근 토큰이 만료되었습니다."}})
    assert not _is_auth_failure_response(200, {"dataBody": {"oMsg": "정상 처리되었습니다."}})


def test_force_refresh_issues_new_token_instead_of_reusing_existing(monkeypatch):
    Env = namedtuple("Env", ["access_token"])
    auth_calls = []

    monkeypatch.setattr(kb_account_service.ka, "read_token_data", lambda: None)
    monkeypatch.setattr(kb_account_service.ka, "getTREnv", lambda: Env("OLD_TOKEN"))
    monkeypatch.setattr(kb_account_service.ka, "read_token", lambda: "OLD_TOKEN")
    monkeypatch.setattr(kb_account_service, "_has_authorization_inputs", lambda mode_cfg: False)

    def fake_auth(**kwargs):
        auth_calls.append(kwargs)
        return "NEW_TOKEN"

    monkeypatch.setattr(kb_account_service.ka, "auth", fake_auth)

    token = _ensure_b2b_account_token("vps", {}, force_refresh=True)

    assert token == "NEW_TOKEN"
    assert auth_calls == [{"svr": "vps", "grant_type": "client_credentials", "force_refresh": True}]


def test_b2b_transport_refreshes_token_and_retries_once(monkeypatch):
    token_calls: list[bool] = []
    post_calls: list[dict[str, str]] = []

    class FakeResponse:
        def __init__(self, status_code: int, body: dict):
            self.status_code = status_code
            self.ok = 200 <= status_code < 300
            self.text = json.dumps(body)

    responses = [
        FakeResponse(401, {"message": "invalid access token"}),
        FakeResponse(200, {"dataBody": {"result": "ok"}}),
    ]

    monkeypatch.setattr(
        kb_account_service.ka,
        "load_config",
        lambda: {
            "dev": {
                "base_url": "https://kb.example.test",
                "client_secret": "1234567890123456",
            },
            "device": {},
        },
    )
    monkeypatch.setattr(kb_account_service, "_current_ui_mode", lambda: "vps")
    monkeypatch.setattr(kb_account_service, "_record_openapi_call", lambda event, payload: None)
    monkeypatch.setattr(kb_account_service, "_encrypt_ecb_pkcs7", lambda secret, plain_body: "encrypted")
    monkeypatch.setattr(kb_account_service, "_decrypt_response_if_needed", lambda body, secret: body)
    monkeypatch.setattr(kb_account_service, "_make_hs_key", lambda token, plain_body: f"hs-{token}")

    def fake_ensure_token(mode, mode_cfg, *, force_refresh=False):
        token_calls.append(force_refresh)
        return "NEW_TOKEN" if force_refresh else "OLD_TOKEN"

    def fake_post(url, headers, json, timeout):
        post_calls.append(headers)
        return responses.pop(0)

    monkeypatch.setattr(kb_account_service, "_ensure_b2b_account_token", fake_ensure_token)
    monkeypatch.setattr(kb_account_service.requests, "post", fake_post)

    transport = KBB2BOpenApiTransport()
    response = transport.call("SAQM9006", {"ciNo": "CI", "nxtKey": "", "hpinNo": ""})

    assert response == {"dataBody": {"result": "ok"}}
    assert token_calls == [False, True]
    assert [headers["Authorization"] for headers in post_calls] == ["bearer OLD_TOKEN", "bearer NEW_TOKEN"]
    assert [headers["hsKey"] for headers in post_calls] == ["hs-OLD_TOKEN", "hs-NEW_TOKEN"]

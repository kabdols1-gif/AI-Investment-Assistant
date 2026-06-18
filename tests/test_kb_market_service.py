from backend.services.kb_market_service import (
    _normalize_executions_response,
    _normalize_orderbook_response,
    _normalize_price_response,
    _resolve_market_identifier,
)


def test_kb_b2c_current_price_is_normalized():
    response = {
        "dataBody": {
            "is_nm": "Samsung Electronics",
            "now_prc": "65,000",
            "bdy_cmpr_ccd": "2",
            "bdy_cmpr": "1,200",
            "up_dwn_r_p2": "1.88",
            "opn_prc": "64,100",
            "hgh_prc": "65,500",
            "lw_prc": "63,800",
            "acml_vlm": "12345678",
            "bdy_dl_tw_amt": "803000000000",
            "dy250_max_prc": "75,000",
            "dy250_min_prc": "55,000",
            "crdt_mgn_rt": "40",
        }
    }

    normalized = _normalize_price_response("005930", response)

    assert normalized is not None
    assert normalized["stock_code"] == "005930"
    assert normalized["stock_name"] == "Samsung Electronics"
    assert normalized["price"] == 65000
    assert normalized["change"] == 1200
    assert normalized["change_rate"] == 1.88
    assert normalized["volume"] == 12345678
    assert normalized["margin_rate"] == 40
    assert normalized["source"] == "kb_b2c"


def test_kb_b2c_orderbook_is_normalized():
    response = {
        "dataBody": {
            "now_prc": "65,000",
            "s1_aprc": "65,100",
            "b1_aprc": "64,900",
            "s_pstn_s1_aprc_q": "1,000",
            "b_pstn_b1_aprc_q": "900",
            "s_askprc_tl_q": "12,000",
            "b_askprc_tl_q": "11,000",
            "expct_ccls_prc": "65,050",
            "expct_ccls_q": "100",
        }
    }

    normalized = _normalize_orderbook_response("005930", response)

    assert normalized is not None
    assert normalized["ask_prices"][0] == 65100
    assert normalized["bid_prices"][0] == 64900
    assert normalized["ask_volumes"][0] == 1000
    assert normalized["bid_volumes"][0] == 900
    assert normalized["total_ask_volume"] == 12000
    assert normalized["total_bid_volume"] == 11000
    assert normalized["expected_price"] == 65050
    assert normalized["expected_volume"] == 100


def test_kb_b2c_executions_are_normalized():
    response = {
        "dataBody": {
            "out": [
                {
                    "ccls_tm": "093001",
                    "ccls_prc": "65,100",
                    "bdy_cmpr_ccd": "4",
                    "bdy_cmpr": "100",
                    "up_dwn_r_p2": "0.15",
                    "sell_buy_ccd": "2",
                    "ccls_q": "30",
                    "acml_vlm": "1,500",
                }
            ]
        }
    }

    normalized = _normalize_executions_response("005930", response)

    assert normalized is not None
    assert normalized["executions"] == [
        {
            "time": "09:30:01",
            "price": 65100,
            "change": -100,
            "change_rate": -0.15,
            "quantity": 30,
            "side": "sell",
            "volume": 1500,
        }
    ]


def test_kb_b2c_overseas_current_price_is_normalized():
    response = {
        "dataBody": {
            "is_nm1": "Apple",
            "now_prc_p4": "1956400",
            "bdy_cmpr_ccd": "5",
            "bdy_cmpr_p4": "12400",
            "bdy_up_dwn_r_p2": "063",
            "opn_prc_p4": "1965000",
            "hgh_prc_p4": "1971200",
            "lw_prc_p4": "1948800",
            "sprc_p4": "1968800",
            "vlm": "123456",
            "dl_tw_amt": "24153000",
            "wk52_max_prc_p4": "2372300",
            "wk52_min_prc_p4": "1640800",
            "dl_crncy": "USD",
            "kor_dt": "20260618",
            "kor_tm": "20441700",
        }
    }

    market = _resolve_market_identifier("AAPL", "NASDAQ")
    normalized = _normalize_price_response("AAPL", response, market=market)

    assert normalized is not None
    assert normalized["stock_code"] == "AAPL"
    assert normalized["stock_name"] == "Apple"
    assert normalized["price"] == 195.64
    assert normalized["change"] == -1.24
    assert normalized["change_rate"] == -0.63
    assert normalized["previous_close"] == 196.88
    assert normalized["timestamp"] == "20260618T20:44:17"
    assert normalized["currency"] == "USD"
    assert normalized["exchange"] == "NAS"
    assert normalized["source"] == "kb_b2c_overseas"


def test_kb_b2c_overseas_orderbook_is_normalized():
    response = {
        "dataBody": {
            "now_prc_p4": "1956400",
            "s_askprc1_p4": "1956500",
            "b_askprc1_p4": "1956300",
            "s_askprc_q1": "100",
            "b_askprc_q1": "90",
            "s_askprc_tl_q": "1200",
            "b_askprc_tl_q": "1100",
            "cas_expct_ccls_prc_p4": "1956400",
            "cas_expct_ccls_q": "50",
            "dl_crncy": "USD",
        }
    }

    market = _resolve_market_identifier("AAPL", "NASDAQ")
    normalized = _normalize_orderbook_response("AAPL", response, market=market)

    assert normalized is not None
    assert normalized["ask_prices"][0] == 195.65
    assert normalized["bid_prices"][0] == 195.63
    assert normalized["ask_volumes"][0] == 100
    assert normalized["bid_volumes"][0] == 90
    assert normalized["current_price"] == 195.64
    assert normalized["expected_price"] == 195.64
    assert normalized["currency"] == "USD"
    assert normalized["source"] == "kb_b2c_overseas"


def test_kb_b2c_overseas_executions_are_normalized():
    response = {
        "dataBody": {
            "dl_crncy": "USD",
            "out2": [
                {
                    "tm": "103001",
                    "now_prc_p4": "1956400",
                    "bdy_cmpr_ccd": "2",
                    "bdy_cmpr_p4": "12400",
                    "bdy_up_dwn_r_p2": "063",
                    "ccls_clsf": "1",
                    "ccls_q": "30",
                    "vlm": "123456",
                }
            ]
        }
    }

    market = _resolve_market_identifier("AAPL", "NASDAQ")
    normalized = _normalize_executions_response("AAPL", response, market=market)

    assert normalized is not None
    assert normalized["currency"] == "USD"
    assert normalized["executions"][0] == {
        "time": "10:30:01",
        "price": 195.64,
        "change": 1.24,
        "change_rate": 0.63,
        "quantity": 30,
        "side": "buy",
        "volume": 123456,
    }


def test_market_identifier_keeps_domestic_and_overseas_routes_separate():
    domestic = _resolve_market_identifier("5930", "KRX")
    overseas = _resolve_market_identifier("AAPL", "NASDAQ")
    numeric_overseas = _resolve_market_identifier("005930", "NASDAQ")

    assert domestic["is_domestic"] is True
    assert domestic["stock_code"] == "005930"
    assert overseas["is_domestic"] is False
    assert overseas["stock_code"] == "AAPL"
    assert overseas["krx_cd"] == "NAS"
    assert numeric_overseas["is_domestic"] is False
    assert numeric_overseas["krx_cd"] == "NAS"

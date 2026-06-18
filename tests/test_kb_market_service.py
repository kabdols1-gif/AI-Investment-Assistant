from backend.services.kb_market_service import (
    _normalize_executions_response,
    _normalize_orderbook_response,
    _normalize_price_response,
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

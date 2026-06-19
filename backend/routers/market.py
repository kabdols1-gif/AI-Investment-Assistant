"""Market data API routes."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from backend.services.kb_market_service import (
    KBMarketServiceError,
    get_kb_current_price,
    get_kb_executions,
    get_kb_orderbook,
)
from backend.services.kis_market_service import (
    KISMarketServiceError,
    stream_kis_realtime_price,
    stream_kis_realtime_prices,
)
from core.websocket_manager import get_ws_manager


logging.basicConfig(level=logging.INFO)

router = APIRouter()


@router.get("/orderbook/{stock_code}")
async def get_orderbook(
    stock_code: str,
    env_dv: str = Query("real", description="Environment (real/demo/prod/vps)"),
    exchange: str | None = Query(None, description="Exchange code/name (KRX, NASDAQ, NYSE, AMEX)"),
):
    """Fetch KB B2C orderbook data."""

    try:
        orderbook = await get_kb_orderbook(stock_code, env_dv, exchange)
        if not orderbook:
            return {
                "status": "error",
                "message": f"Orderbook lookup failed: {stock_code}",
            }
        return {
            "status": "success",
            "data": orderbook,
        }
    except KBMarketServiceError as exc:
        logging.error("KB orderbook lookup failed: %s", exc)
        return {
            "status": "error",
            "message": str(exc),
        }
    except Exception as exc:
        logging.error("Orderbook lookup failed: %s", exc)
        return {
            "status": "error",
            "message": str(exc),
        }


@router.get("/price/{stock_code}")
async def get_current_price(
    stock_code: str,
    env_dv: str = Query("real", description="Environment (real/demo/prod/vps)"),
    exchange: str | None = Query(None, description="Exchange code/name (KRX, NASDAQ, NYSE, AMEX)"),
):
    """Fetch KB B2C current price data."""

    try:
        price_data = await get_kb_current_price(stock_code, env_dv, exchange)
        if not price_data:
            return {
                "status": "error",
                "message": f"Current price lookup failed: {stock_code}",
            }
        return {
            "status": "success",
            "data": price_data,
        }
    except KBMarketServiceError as exc:
        logging.error("KB current price lookup failed: %s", exc)
        return {
            "status": "error",
            "message": str(exc),
        }
    except Exception as exc:
        logging.error("Current price lookup failed: %s", exc)
        return {
            "status": "error",
            "message": str(exc),
        }


@router.get("/executions/{stock_code}")
async def get_executions(
    stock_code: str,
    env_dv: str = Query("real", description="Environment (real/demo/prod/vps)"),
    count: int = Query(10, ge=1, le=50, description="Execution record count"),
    exchange: str | None = Query(None, description="Exchange code/name (KRX, NASDAQ, NYSE, AMEX)"),
):
    """Fetch KB B2C time-and-sales execution data."""

    try:
        executions = await get_kb_executions(stock_code, env_dv, count, exchange)
        if not executions:
            return {
                "status": "error",
                "message": f"Execution lookup failed: {stock_code}",
            }
        return {
            "status": "success",
            "data": executions,
        }
    except KBMarketServiceError as exc:
        logging.error("KB execution lookup failed: %s", exc)
        return {
            "status": "error",
            "message": str(exc),
        }
    except Exception as exc:
        logging.error("Execution lookup failed: %s", exc)
        return {
            "status": "error",
            "message": str(exc),
        }


@router.websocket("/ws/price/{stock_code}")
async def websocket_price(websocket: WebSocket, stock_code: str, env_dv: str = "real", exchange: str | None = None):
    """Stream KIS realtime price frames for a stock."""

    await websocket.accept()
    logging.info("KIS price WebSocket connected: %s exchange=%s", stock_code, exchange or "-")

    try:
        async for price_data in stream_kis_realtime_price(stock_code, env_dv, exchange):
            await websocket.send_json(
                {
                    "type": "price",
                    "stock_code": stock_code,
                    "exchange": exchange,
                    "source": "kis_realtime",
                    "data": price_data,
                }
            )
    except WebSocketDisconnect:
        pass
    except KISMarketServiceError as exc:
        logging.error("KIS realtime price failed: %s", exc)
        try:
            await websocket.send_json(
                {
                    "type": "status",
                    "status": "error",
                    "message": str(exc),
                }
            )
        except Exception:
            pass
    except Exception as exc:
        logging.error("KIS price WebSocket failed: %s", exc)
        try:
            await websocket.send_json(
                {
                    "type": "status",
                    "status": "error",
                    "message": str(exc),
                }
            )
        except Exception:
            pass
    finally:
        logging.info("KIS price WebSocket closed: %s exchange=%s", stock_code, exchange or "-")


@router.websocket("/ws/prices")
async def websocket_prices(websocket: WebSocket, codes: str = "", env_dv: str = "real", exchange: str | None = None):
    """Stream KIS realtime price frames for multiple stocks."""

    await websocket.accept()
    stock_codes = [code.strip() for code in codes.split(",") if code.strip()]
    logging.info("KIS multi-price WebSocket connected: %s exchange=%s", ",".join(stock_codes), exchange or "-")

    if not stock_codes:
        await websocket.send_json(
            {
                "type": "status",
                "status": "error",
                "message": "At least one stock code is required.",
            }
        )
        await websocket.close(code=1008, reason="Missing stock codes")
        return

    try:
        await websocket.send_json(
            {
                "type": "status",
                "status": "subscribing",
                "source": "kis_realtime",
                "stock_codes": stock_codes,
                "exchange": exchange,
            }
        )
        async for price_data in stream_kis_realtime_prices(stock_codes, env_dv, exchange):
            await websocket.send_json(
                {
                    "type": "price",
                    "stock_code": price_data.get("stock_code"),
                    "exchange": exchange,
                    "source": "kis_realtime",
                    "data": price_data,
                }
            )
    except WebSocketDisconnect:
        pass
    except KISMarketServiceError as exc:
        logging.error("KIS multi realtime price failed: %s", exc)
        try:
            await websocket.send_json(
                {
                    "type": "status",
                    "status": "error",
                    "message": str(exc),
                }
            )
        except Exception:
            pass
    except Exception as exc:
        logging.error("KIS multi price WebSocket failed: %s", exc)
        try:
            await websocket.send_json(
                {
                    "type": "status",
                    "status": "error",
                    "message": str(exc),
                }
            )
        except Exception:
            pass
    finally:
        logging.info("KIS multi-price WebSocket closed: %s exchange=%s", ",".join(stock_codes), exchange or "-")


@router.websocket("/ws/{stock_code}")
async def websocket_orderbook(websocket: WebSocket, stock_code: str, exchange: str | None = None):
    """Poll KB B2C orderbook data and push it over a WebSocket."""

    await websocket.accept()
    logging.info("Orderbook WebSocket connected: %s", stock_code)

    ws_manager = get_ws_manager()
    if not ws_manager.running:
        try:
            await ws_manager.start()
        except Exception as exc:
            logging.error("Orderbook WebSocket manager failed to start: %s", exc)
            await websocket.close(code=1011, reason="Internal error")
            return

    try:
        await ws_manager.subscribe_orderbook(stock_code, websocket, exchange)
    except Exception as exc:
        logging.error("Orderbook subscription failed: %s", exc)
        await websocket.close(code=1011, reason="Subscription failed")
        return

    try:
        while True:
            try:
                await websocket.receive_text()
            except WebSocketDisconnect:
                break
    except Exception as exc:
        logging.error("Orderbook WebSocket failed: %s", exc)
    finally:
        await ws_manager.unsubscribe_orderbook(stock_code, websocket, exchange)
        logging.info("Orderbook WebSocket closed: %s", stock_code)

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
)
from core.websocket_manager import get_ws_manager


logging.basicConfig(level=logging.INFO)

router = APIRouter()


@router.get("/orderbook/{stock_code}")
async def get_orderbook(
    stock_code: str,
    env_dv: str = Query("real", description="Environment (real/demo/prod/vps)"),
):
    """Fetch KB B2C orderbook data."""

    try:
        orderbook = await get_kb_orderbook(stock_code, env_dv)
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
):
    """Fetch KB B2C current price data."""

    try:
        price_data = await get_kb_current_price(stock_code, env_dv)
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
):
    """Fetch KB B2C time-and-sales execution data."""

    try:
        executions = await get_kb_executions(stock_code, env_dv, count)
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
async def websocket_price(websocket: WebSocket, stock_code: str, env_dv: str = "real"):
    """Stream KIS realtime price frames for a stock."""

    await websocket.accept()
    logging.info("KIS price WebSocket connected: %s", stock_code)

    try:
        async for price_data in stream_kis_realtime_price(stock_code, env_dv):
            await websocket.send_json(
                {
                    "type": "price",
                    "stock_code": stock_code,
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
        logging.info("KIS price WebSocket closed: %s", stock_code)


@router.websocket("/ws/{stock_code}")
async def websocket_orderbook(websocket: WebSocket, stock_code: str):
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
        await ws_manager.subscribe_orderbook(stock_code, websocket)
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
        await ws_manager.unsubscribe_orderbook(stock_code, websocket)
        logging.info("Orderbook WebSocket closed: %s", stock_code)

"""Trading account API routes.

Account/holdings/buyable APIs are placeholders until the trading endpoints
are mapped.  Authentication and account identity come from ``kb_auth``.
"""

from __future__ import annotations

import asyncio
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel

from backend import is_authenticated
from backend.brokers.errors import BrokerError
from backend.brokers.models import BalanceSummary, BuyableAmount, Holding
from backend.brokers.registry import get_broker_adapter
from backend.services import secure_config
from backend.services.kb_account_service import KBAccountServiceError, get_kb_balance_evaluation
from backend.services.masking import mask_value
import kb_auth as ka

router = APIRouter()


class LogEntry(BaseModel):
    type: str
    message: str
    timestamp: str


class ApiResponse(BaseModel):
    status: str
    data: object | None = None
    message: str = ""
    logs: list[LogEntry] = []


def _log(log_type: str, message: str) -> LogEntry:
    return LogEntry(type=log_type, message=message, timestamp=datetime.now().strftime("%H:%M:%S"))


def _not_ready(message: str) -> ApiResponse:
    return ApiResponse(status="error", message=message, logs=[_log("warning", message)])


async def _get_balance_evaluation(force_refresh: bool = False):
    return await asyncio.to_thread(get_kb_balance_evaluation, force_refresh)


def _selected_broker() -> str:
    config = secure_config.load_config()
    kb_config = config.get("kb", {}) if isinstance(config.get("kb"), dict) else {}
    broker_config = config.get("broker", {}) if isinstance(config.get("broker"), dict) else {}
    broker = kb_config.get("broker") or broker_config.get("provider") or "kb"
    return str(broker).strip() or "kb"


def _selected_broker_name(broker: str) -> str:
    return secure_config.BROKER_NAMES.get(broker, broker)


def _selected_account_no() -> str:
    config = secure_config.load_config()
    kb_config = config.get("kb", {}) if isinstance(config.get("kb"), dict) else {}
    broker_config = config.get("broker", {}) if isinstance(config.get("broker"), dict) else {}
    account = broker_config.get("account_no") or kb_config.get("account") or ""
    return str(account).strip()


def _adapter_error_response(exc: BrokerError, broker: str) -> ApiResponse:
    feature = f" ({exc.feature})" if exc.feature else ""
    return _not_ready(f"{_selected_broker_name(broker)} API{feature} 매핑이 아직 준비되지 않았습니다.")


def _holding_to_response(holding: Holding) -> dict:
    avg_price = float(holding.average_price or 0)
    eval_amount = float(holding.evaluation_amount or 0)
    quantity = int(holding.quantity or 0)
    current_price = eval_amount / quantity if quantity > 0 and eval_amount > 0 else 0
    profit_loss = float(holding.profit_loss or 0)
    purchase_amount = avg_price * quantity
    profit_rate = float(holding.profit_rate or 0)
    return {
        "stock_code": holding.symbol,
        "stock_name": holding.name or holding.symbol,
        "quantity": quantity,
        "orderable_quantity": quantity,
        "avg_price": avg_price,
        "current_price": current_price,
        "purchase_amount": purchase_amount,
        "eval_amount": eval_amount,
        "profit_loss": profit_loss,
        "profit_rate": profit_rate,
        "currency": "KRW",
        "raw": holding.raw,
    }


def _balance_to_response(balance: BalanceSummary, holdings: list[dict]) -> dict:
    purchase_amount = float(balance.purchase_amount or sum(item.get("purchase_amount", 0) for item in holdings))
    eval_amount = float(balance.evaluation_amount or sum(item.get("eval_amount", 0) for item in holdings))
    profit_loss = float(balance.profit_loss or (eval_amount - purchase_amount if purchase_amount else 0))
    profit_rate = (profit_loss / purchase_amount) * 100 if purchase_amount > 0 else 0
    deposit = float(balance.cash or 0)
    total_eval = float(balance.total_asset or deposit + eval_amount)
    return {
        "deposit": deposit,
        "total_eval": total_eval,
        "purchase_amount": purchase_amount,
        "eval_amount": eval_amount,
        "profit_loss": profit_loss,
        "profit_rate": profit_rate,
        "holdings": holdings,
        "holdings_count": len(holdings),
        "source": balance.broker,
        "raw_response_masked": balance.raw,
    }


def _buyable_to_response(buyable: BuyableAmount) -> dict:
    return {
        "stock_code": buyable.symbol,
        "price": float(buyable.price or 0),
        "amount": float(buyable.amount or 0),
        "quantity": int(buyable.quantity or 0),
        "raw": buyable.raw,
    }


@router.get("/info", response_model=ApiResponse)
async def get_account_info():
    broker = _selected_broker()
    if broker != "kb":
        try:
            adapter = get_broker_adapter(broker)
            status = await adapter.test_connection()
        except BrokerError as exc:
            return _adapter_error_response(exc, broker)
        if status.status != "success":
            return _not_ready(status.message)
        account = _selected_account_no()
        return ApiResponse(
            status="success",
            data={
                "account_no": mask_value(account) if account else "",
                "account_no_full": account,
                "account_type": "Trading Account",
                "prod_code": "",
                "is_vps": True,
                "mode": "paper",
                "broker": broker,
                "broker_name": _selected_broker_name(broker),
            },
            logs=[_log("success", f"{_selected_broker_name(broker)} account connection verified.")],
        )

    if not is_authenticated():
        return _not_ready("거래 인증이 필요합니다.")

    trenv = ka.getTREnv()
    account = trenv.account or trenv.my_acct
    masked = f"{account[:4]}****" if account else ""
    return ApiResponse(
        status="success",
        data={
            "account_no": masked,
            "account_no_full": account,
            "account_type": "Trading Account",
            "prod_code": trenv.my_prod,
            "is_vps": ka.isPaperTrading(),
            "mode": "개발 모드" if ka.isPaperTrading() else "실전 모드",
        },
        logs=[_log("success", "계좌 인증 정보를 불러왔습니다.")],
    )


@router.get("/holdings", response_model=ApiResponse)
async def get_holdings(force_refresh: bool = False):
    broker = _selected_broker()
    if broker != "kb":
        try:
            adapter = get_broker_adapter(broker)
            holdings = await adapter.get_holdings()
        except BrokerError as exc:
            return _adapter_error_response(exc, broker)
        return ApiResponse(
            status="success",
            data=[_holding_to_response(item) for item in holdings],
            message=f"{_selected_broker_name(broker)} holdings loaded.",
            logs=[_log("success", "Holdings loaded.")],
        )

    if not is_authenticated():
        return _not_ready("거래 인증이 필요합니다.")
    try:
        evaluation = await _get_balance_evaluation(force_refresh)
    except KBAccountServiceError as exc:
        return _not_ready(str(exc))
    return ApiResponse(
        status="success",
        data=evaluation.holdings,
        message="KB B2B SSQM2952 잔고평가에서 보유 종목을 조회했습니다.",
        logs=[_log("success", "보유 종목을 불러왔습니다.")],
    )


@router.get("/balance", response_model=ApiResponse)
async def get_balance(force_refresh: bool = False):
    broker = _selected_broker()
    if broker != "kb":
        try:
            adapter = get_broker_adapter(broker)
            balance = await adapter.get_balance()
            try:
                holdings = [_holding_to_response(item) for item in await adapter.get_holdings()]
            except BrokerError:
                holdings = []
        except BrokerError as exc:
            return _adapter_error_response(exc, broker)
        return ApiResponse(
            status="success",
            data=_balance_to_response(balance, holdings),
            message=f"{_selected_broker_name(broker)} balance loaded.",
            logs=[_log("success", "Balance loaded.")],
        )

    if not is_authenticated():
        return _not_ready("거래 인증이 필요합니다.")
    try:
        evaluation = await _get_balance_evaluation(force_refresh)
    except KBAccountServiceError as exc:
        return _not_ready(str(exc))
    return ApiResponse(
        status="success",
        data=evaluation.as_balance_response(),
        message="KB B2B SAQM9006 계좌 조회 후 SSQM2952 잔고평가를 조회했습니다.",
        logs=[_log("success", "잔고평가를 불러왔습니다.")],
    )


@router.get("/buyable/{stock_code}", response_model=ApiResponse)
async def get_buyable_amount(stock_code: str, price: int = 0):
    broker = _selected_broker()
    if broker != "kb":
        try:
            adapter = get_broker_adapter(broker)
            buyable = await adapter.get_buyable_amount(stock_code, price or None)
        except BrokerError as exc:
            return _adapter_error_response(exc, broker)
        return ApiResponse(
            status="success",
            data=_buyable_to_response(buyable),
            message=f"{_selected_broker_name(broker)} buyable amount loaded.",
            logs=[_log("success", "Buyable amount loaded.")],
        )

    if not is_authenticated():
        return _not_ready("거래 인증이 필요합니다.")
    return _not_ready("매수 가능 금액 API는 아직 구현되지 않았습니다.")

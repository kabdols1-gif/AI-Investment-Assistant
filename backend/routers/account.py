"""Trading account API routes.

Account/holdings/buyable APIs are placeholders until the trading endpoints
are mapped.  Authentication and account identity come from ``kb_auth``.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel

from backend import is_authenticated
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


@router.get("/info", response_model=ApiResponse)
async def get_account_info():
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
async def get_holdings():
    if not is_authenticated():
        return _not_ready("거래 인증이 필요합니다.")
    return _not_ready("보유 종목 API는 아직 구현되지 않았습니다.")


@router.get("/balance", response_model=ApiResponse)
async def get_balance():
    if not is_authenticated():
        return _not_ready("거래 인증이 필요합니다.")
    return _not_ready("잔고 API는 아직 구현되지 않았습니다.")


@router.get("/buyable/{stock_code}", response_model=ApiResponse)
async def get_buyable_amount(stock_code: str, price: int = 0):
    if not is_authenticated():
        return _not_ready("거래 인증이 필요합니다.")
    return _not_ready("매수 가능 금액 API는 아직 구현되지 않았습니다.")

"""
?몄쬆 愿??API Router

Mode Switching Feature:
- POST /login: ?몄쬆 (紐⑤뱶 吏??
- GET /status: ?몄쬆 ?곹깭 諛?紐⑤뱶 ?뺣낫
- POST /switch-mode: 紐⑤뱶 ?꾪솚 (1遺?荑⑤떎??
- POST /logout: 濡쒓렇?꾩썐
"""
import asyncio

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend import get_current_mode, get_status
from backend.state import trading_state

router = APIRouter()


class LoginRequest(BaseModel):
    mode: str = "vps"  # vps(紐⑥쓽) or prod(?ㅼ쟾)


class SwitchModeRequest(BaseModel):
    mode: str  # vps(紐⑥쓽) or prod(?ㅼ쟾)


class AuthStatusResponse(BaseModel):
    authenticated: bool
    mode: str
    mode_display: str
    account: str | None = None
    can_switch_mode: bool
    cooldown_remaining: int


@router.post("/login")
async def login(request: LoginRequest):
    """거래 API 인증
    
    Args:
        mode: ?몃젅?대뵫 紐⑤뱶 ("vps" 紐⑥쓽?ъ옄, "prod" ?ㅼ쟾?ъ옄)
        
    Returns:
        ?몄쬆 寃곌낵
    """
    if request.mode not in ("vps", "prod"):
        raise HTTPException(
            status_code=400,
            detail="mode??'vps' ?먮뒗 'prod'留?媛?ν빀?덈떎."
        )
    
    try:
        loop = asyncio.get_running_loop()
        await asyncio.wait_for(
            loop.run_in_executor(None, trading_state.authenticate, request.mode),
            timeout=60.0,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=408,
            detail="Authentication timed out after 60 seconds. Check the local trading API config file.",
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    status = get_status()
    return {"status": "success", **status}


@router.get("/status", response_model=AuthStatusResponse)
async def get_auth_status():
    """?몄쬆 ?곹깭 ?뺤씤
    
    Returns:
        ?몄쬆 ?곹깭, ?꾩옱 紐⑤뱶, 紐⑤뱶 ?꾪솚 媛???щ?, 荑⑤떎???쒓컙
    """
    status = get_status()
    return AuthStatusResponse(**status)


@router.post("/switch-mode")
async def switch_mode(request: SwitchModeRequest):
    """?몃젅?대뵫 紐⑤뱶 ?꾪솚
    
    紐⑥쓽?ъ옄(vps) ???ㅼ쟾?ъ옄(prod) ?꾪솚
    1遺?荑⑤떎???곸슜
    
    Args:
        mode: ?꾪솚??紐⑤뱶 ("vps" ?먮뒗 "prod")
        
    Returns:
        ?꾪솚 寃곌낵
        
    Raises:
        400: ?좏슚?섏? ?딆? 紐⑤뱶 ?먮뒗 荑⑤떎??以?
    """
    if request.mode not in ("vps", "prod"):
        raise HTTPException(
            status_code=400,
            detail="mode??'vps' ?먮뒗 'prod'留?媛?ν빀?덈떎."
        )
    
    if request.mode == get_current_mode():
        raise HTTPException(
            status_code=400,
            detail=f"?대? {trading_state.mode_display} 紐⑤뱶?낅땲??"
        )
    
    try:
        loop = asyncio.get_running_loop()
        await asyncio.wait_for(
            loop.run_in_executor(None, trading_state.authenticate, request.mode),
            timeout=60.0,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=408,
            detail="Authentication timed out after 60 seconds. Check the local trading API config file.",
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    status = get_status()
    return {
        "status": "success",
        "message": f"{trading_state.mode_display}濡??꾪솚?섏뿀?듬땲??",
        **status,
    }


@router.post("/logout")
async def logout():
    """濡쒓렇?꾩썐
    
    ?좏겙 ??젣 諛??몄쬆 ?곹깭 珥덇린??
    """
    trading_state.logout()
    return {
        "status": "success",
        "message": "濡쒓렇?꾩썐?섏뿀?듬땲??",
        "authenticated": False
    }


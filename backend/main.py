"""
Strategy Builder - FastAPI Backend
"""

import os
import sys
from contextlib import asynccontextmanager

# 프로젝트 루트를 path에 추가
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import account, actions, auth, broker, config, files, market, orders, strategy, symbols, voice
from backend.services.symbol_scheduler import start_symbol_scheduler, stop_symbol_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 시작/종료 수명주기."""
    await start_symbol_scheduler()
    try:
        yield
    finally:
        await stop_symbol_scheduler()

# FastAPI 앱 생성
app = FastAPI(
    title="Strategy Builder",
    description="AI trading strategy builder",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(auth.router, prefix="/api/auth", tags=["인증"])
app.include_router(strategy.router, prefix="/api/strategies", tags=["전략"])
app.include_router(market.router, prefix="/api/market", tags=["시장정보"])
app.include_router(orders.router, prefix="/api/orders", tags=["주문"])
app.include_router(account.router, prefix="/api/account", tags=["계좌"])
app.include_router(files.router, prefix="/api/files", tags=["파일"])
app.include_router(symbols.router, prefix="/api/symbols", tags=["종목"])
app.include_router(voice.router, prefix="/api/voice", tags=["voice"])
app.include_router(config.router, prefix="/api/config", tags=["config"])
app.include_router(actions.router, prefix="/api/actions", tags=["actions"])
app.include_router(broker.router, prefix="/api/brokers", tags=["brokers"])


@app.get("/api/health")
async def health_check():
    """헬스 체크"""
    return {"status": "healthy"}


@app.get("/")
async def root():
    """API 루트"""
    return {"message": "Strategy Builder API", "docs": "/docs"}


# 서버 실행
if __name__ == "__main__":
    import uvicorn

    print("=" * 50)
    print(" Strategy Builder server starting")
    print("=" * 50)
    print(" URL: http://localhost:8010")
    print("=" * 50)

    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8010,
        reload=True
    )

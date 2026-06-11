"""Daily symbol master loader.

FastAPI 서버가 켜져 있는 동안 국내/해외 종목 마스터를 하루 한 번 갱신합니다.
별도 스케줄러 패키지 없이 asyncio task로 동작하게 두어 배포 구성을 단순하게 유지합니다.
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from backend.routers import symbols

logger = logging.getLogger(__name__)

_scheduler_task: asyncio.Task | None = None


async def start_symbol_scheduler() -> None:
    """종목 마스터 자동 로드 스케줄러 시작."""
    global _scheduler_task

    if os.getenv("SYMBOL_AUTO_LOAD_ENABLED", "true").lower() in {"0", "false", "no", "off"}:
        logger.info("종목 마스터 자동 로드가 비활성화되어 있습니다.")
        return

    if _scheduler_task and not _scheduler_task.done():
        return

    _scheduler_task = asyncio.create_task(_daily_symbol_loader_loop(), name="symbol-master-loader")


async def stop_symbol_scheduler() -> None:
    """종목 마스터 자동 로드 스케줄러 종료."""
    global _scheduler_task

    if not _scheduler_task:
        return

    _scheduler_task.cancel()
    try:
        await _scheduler_task
    except asyncio.CancelledError:
        pass
    finally:
        _scheduler_task = None


async def _daily_symbol_loader_loop() -> None:
    timezone = ZoneInfo(os.getenv("SYMBOL_AUTO_LOAD_TIMEZONE", "Asia/Seoul"))
    run_time = _parse_run_time(os.getenv("SYMBOL_AUTO_LOAD_TIME", "07:30"))

    await _collect_if_needed("startup")

    while True:
        now = datetime.now(timezone)
        next_run = _next_run_at(now, run_time)
        sleep_seconds = max(60.0, (next_run - now).total_seconds())
        logger.info("다음 종목 마스터 자동 로드 예정: %s", next_run.isoformat())
        await asyncio.sleep(sleep_seconds)
        await _collect_if_needed("scheduled")


async def _collect_if_needed(reason: str) -> None:
    if not symbols._check_needs_update():
        logger.info("종목 마스터 자동 로드 생략: 오늘 이미 최신 상태입니다. reason=%s", reason)
        return

    logger.info("종목 마스터 자동 로드 시작: reason=%s", reason)
    result = await symbols.collect_master_files_for_exchanges(symbols.SUPPORTED_EXCHANGES)

    if result.success:
        logger.info(
            "종목 마스터 자동 로드 완료: domestic=%s overseas=%s total=%s",
            result.domestic_count,
            result.overseas_count,
            result.total_count,
        )
    else:
        logger.warning("종목 마스터 자동 로드 일부 실패: errors=%s", result.errors)


def _parse_run_time(value: str) -> time:
    try:
        hour_text, minute_text = value.split(":", 1)
        return time(hour=int(hour_text), minute=int(minute_text))
    except Exception:
        logger.warning("SYMBOL_AUTO_LOAD_TIME 값이 올바르지 않아 07:30으로 대체합니다: %s", value)
        return time(hour=7, minute=30)


def _next_run_at(now: datetime, run_time: time) -> datetime:
    today_run = now.replace(hour=run_time.hour, minute=run_time.minute, second=0, microsecond=0)
    if today_run <= now:
        return today_run + timedelta(days=1)
    return today_run

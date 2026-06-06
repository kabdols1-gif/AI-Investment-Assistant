"""Match voice intents to Strategy Builder presets."""

from __future__ import annotations

from typing import Any

import strategy_core.preset  # noqa: F401 - registers presets
from backend.schemas.voice import LLMIntent, StrategyAnalysis, VoiceStrategyMatch
from backend.services.intent_service import _resolve_symbol
from strategy_core import StrategyRegistry


KEYWORD_MAP: dict[str, tuple[str, ...]] = {
    "golden_cross": ("golden", "골든", "크로스", "이동평균", "ma", "평균선"),
    "momentum": ("momentum", "모멘텀", "상승률", "강한 종목", "추세"),
    "trend_filter": ("trend", "추세", "필터", "상승 추세", "하락 추세"),
    "week52_high": ("52", "신고가", "52주", "고점"),
    "consecutive": ("연속", "며칠", "상승일", "하락일"),
    "disparity": ("이격", "이격도", "과열", "과매도"),
    "breakout_fail": ("돌파 실패", "실패", "가짜 돌파", "false"),
    "strong_close": ("종가", "강한 종가", "고가 근처", "마감"),
    "volatility": ("변동성", "돌파", "volatility", "박스권"),
    "mean_reversion": ("평균회귀", "반등", "되돌림", "과매도", "저평가"),
}

KOREAN_NAMES = {
    "golden_cross": "골든크로스",
    "momentum": "모멘텀",
    "trend_filter": "추세 필터",
    "week52_high": "52주 신고가",
    "consecutive": "연속 상승/하락",
    "disparity": "이격도",
    "breakout_fail": "돌파 실패",
    "strong_close": "강한 종가",
    "volatility": "변동성 돌파",
    "mean_reversion": "평균회귀",
}

KOREAN_CATEGORIES = {
    "trend": "추세",
    "breakout": "돌파",
    "mean_reversion": "평균회귀",
    "momentum": "모멘텀",
    "risk": "위험관리",
}


def _default_params(strategy: dict[str, Any]) -> dict[str, Any]:
    params: dict[str, Any] = {}
    for item in strategy.get("params") or []:
        name = item.get("name")
        if name:
            params[name] = item.get("default", 0)
    return params


def _score_strategy(strategy_id: str, text: str, intent: LLMIntent) -> tuple[float, list[str]]:
    lowered = text.lower()
    matched = [keyword for keyword in KEYWORD_MAP.get(strategy_id, ()) if keyword.lower() in lowered]
    score = 0.2 + min(0.6, len(matched) * 0.18)

    condition = intent.condition_type or ""
    if strategy_id == "golden_cross" and condition == "ma_cross":
        score += 0.35
        matched.append("이동평균 교차 조건")
    if strategy_id == "volatility" and condition == "price_above_ma":
        score += 0.25
        matched.append("돌파 조건")
    if strategy_id == "mean_reversion" and condition.startswith("rsi_"):
        score += 0.2
        matched.append("RSI 조건")
    if strategy_id == "momentum" and "momentum" in condition:
        score += 0.25
        matched.append("모멘텀 조건")

    return min(score, 0.98), matched


def _display_name(strategy: dict[str, Any]) -> str:
    strategy_id = strategy.get("id", "")
    return KOREAN_NAMES.get(strategy_id) or strategy.get("name") or strategy_id


def _display_category(category: str) -> str:
    return KOREAN_CATEGORIES.get(category, category)


def analyze_strategies(intent: LLMIntent, source_text: str = "") -> StrategyAnalysis:
    code, name = _resolve_symbol(intent)
    strategies = StrategyRegistry.get_list()
    matches: list[VoiceStrategyMatch] = []

    for strategy in strategies:
        strategy_id = strategy.get("id", "")
        score, matched = _score_strategy(strategy_id, source_text, intent)
        if score < 0.34 and len(matches) >= 3:
            continue

        reason = (
            f"음성 명령에서 {', '.join(dict.fromkeys(matched[:3]))} 표현이 감지되었습니다."
            if matched
            else "음성 조건과 기본 전략 후보를 비교한 기본 추천입니다."
        )
        matches.append(
            VoiceStrategyMatch(
                strategy_id=strategy_id,
                name=_display_name(strategy),
                description=strategy.get("description") or "기존 Strategy Builder 프리셋 전략입니다.",
                category=_display_category(strategy.get("category", "")),
                confidence=score,
                reason=reason,
                params=_default_params(strategy),
                builder_state=strategy.get("builder_state"),
            )
        )

    matches.sort(key=lambda item: item.confidence, reverse=True)
    recommended = matches[:3]

    blockers = []
    if not code:
        blockers.append("종목 코드가 확인되지 않았습니다.")
    if not recommended:
        blockers.append("실행 가능한 전략 후보가 없습니다.")

    condition_summary = intent.condition_type or "명시된 조건 없음"
    if intent.condition_params:
        condition_summary = f"{condition_summary} {intent.condition_params}"

    best = recommended[0].name if recommended else "추천 전략 없음"
    final_answer = (
        f"요청을 분석한 결과 {best} 전략이 가장 적합합니다. "
        "아래 전략 분석 결과를 확인한 뒤 실행 버튼을 누르면 선택 종목에 전략 신호를 생성합니다."
    )
    if blockers:
        final_answer += f" 단, {' '.join(blockers)}"

    return StrategyAnalysis(
        summary=f"{intent.raw_summary} / 추천 전략 {len(recommended)}개",
        detected_symbol_name=name or intent.symbol_name,
        detected_symbol_code=code,
        condition_summary=condition_summary,
        llm_final_answer=final_answer,
        recommended=recommended,
        execution_ready=not blockers,
        execution_blockers=blockers,
    )


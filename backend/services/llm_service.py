"""Intent interpretation service backed by configured external LLM providers."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

import httpx
from pydantic import ValidationError

from backend.schemas.voice import LLMIntent, VoiceCommand
from backend.services import secure_config


BUY_TERMS = ("buy", "\ub9e4\uc218", "\uc0ac\uc918", "\uc0ac\uc8fc", "\uc0ac\uc57c")
SELL_TERMS = ("sell", "\ub9e4\ub3c4", "\ud314\uc544", "\ud314\uc790", "\ud314\uc544\uc918")
STRATEGY_TERMS = (
    "strategy",
    "\uc804\ub7b5",
    "\uc608\uc57d",
    "\uc870\uac74",
    "\ub3cc\ud30c",
    "rsi",
    "ma",
    "\uc774\ub3d9\ud3c9\uade0",
    "\uace8\ub4e0",
    "\uace8\ub4e0\ud06c\ub85c\uc2a4",
)
ACCOUNT_TERMS = ("balance", "account", "\uc794\uace0", "\uacc4\uc88c", "\uc608\uc218\uae08")
EXPLAIN_TERMS = ("explain", "\uc124\uba85", "\uc54c\ub824")
MARKET_TERMS = ("시장", "브리핑", "시황", "증시", "market", "briefing")
ASSET_TERMS = ("자산", "총자산", "손익", "수익률", "내 자산")
MY_STRATEGY_TERMS = ("내 전략", "전략 상태", "실행 중인 전략", "전략 꺼", "전략 켜")
RECOMMEND_STRATEGY_TERMS = ("추천 전략", "전략 추천", "제안", "공격형", "안정형", "중립형")
WATCHLIST_TERMS = ("관심", "관심종목", "관심 목록", "목표가", "손절가")
PORTFOLIO_TERMS = ("포트폴리오", "리밸런싱", "성과", "portfolio")
NOTIFICATION_TERMS = ("알림", "미확인", "체결 알림", "리스크 경고")
SETTING_TERMS = ("설정", "api key", "openapi", "목소리", "보안", "인증", "테마")

COMMON_SYMBOLS = (
    {
        "code": "005930",
        "name": "\uc0bc\uc131\uc804\uc790",
        "aliases": ("samsung", "samsung electronics", "\uc0bc\uc131\uc804\uc790", "\uc0bc\uc131"),
    },
    {
        "code": "000660",
        "name": "SK hynix",
        "aliases": ("sk hynix", "hynix", "\ud558\uc774\ub2c9\uc2a4", "sk\ud558\uc774\ub2c9\uc2a4"),
    },
    {
        "code": "105560",
        "name": "Trading Assistant",
        "aliases": ("kb financial", "kb", "\uad6d\ubbfc\uc740\ud589", "kb\uae08\uc735", "\ucf00\uc774\ube44\uae08\uc735"),
    },
)


@dataclass(frozen=True)
class ParsedSymbol:
    code: str | None = None
    name: str | None = None


def _contains_any(text: str, terms: tuple[str, ...]) -> bool:
    return any(term in text for term in terms)


def _parse_int(value: str) -> int:
    return int(value.replace(",", ""))


def _parse_quantity(text: str) -> int | None:
    match = re.search(r"(\d[\d,]*)\s*(?:shares?|\uc8fc)", text, flags=re.IGNORECASE)
    return _parse_int(match.group(1)) if match else None


def _parse_amount_krw(text: str) -> int | None:
    manwon = re.search(r"(\d[\d,]*)\s*\ub9cc\s*\uc6d0", text)
    if manwon:
        return _parse_int(manwon.group(1)) * 10_000

    won = re.search(r"(\d[\d,]*)\s*(?:krw|\uc6d0)", text, flags=re.IGNORECASE)
    if won:
        return _parse_int(won.group(1))

    return None


def _parse_symbol(text: str) -> ParsedSymbol:
    code_match = re.search(r"\b\d{6}\b", text)
    if code_match:
        return ParsedSymbol(code=code_match.group(0))

    lowered = text.lower()
    for stock in COMMON_SYMBOLS:
        for alias in stock["aliases"]:
            if alias.lower() in lowered:
                return ParsedSymbol(code=stock["code"], name=stock["name"])

    return ParsedSymbol()


def _parse_condition(text: str) -> tuple[str | None, dict]:
    lowered = text.lower()

    if "\uace8\ub4e0" in lowered or "golden" in lowered:
        return "ma_cross", {"fast_period": 5, "slow_period": 20}

    period_match = re.search(r"(\d+)\s*(?:day|d|ma|\uc77c\uc120|\uc77c)", lowered)
    if "\ub3cc\ud30c" in lowered or "break" in lowered or "above" in lowered:
        return "price_above_ma", {"period": int(period_match.group(1)) if period_match else 20}

    if "rsi" in lowered:
        number = re.search(r"rsi\D*(\d+)", lowered)
        threshold = int(number.group(1)) if number else 30
        condition = "rsi_below" if threshold <= 50 else "rsi_above"
        return condition, {"threshold": threshold}

    if "\ubaa8\uba58\ud140" in lowered or "momentum" in lowered:
        return "momentum", {"lookback": 20}

    return None, {}


ALLOWED_INTENTS = (
    "get_market_briefing",
    "get_asset_summary",
    "get_strategy_status",
    "recommend_strategy",
    "create_strategy",
    "create_strategy_candidate",
    "create_order_draft",
    "query_account_summary",
    "explain_strategy",
    "get_watchlist_summary",
    "add_watchlist_item",
    "set_price_alert",
    "get_portfolio_summary",
    "recommend_rebalancing",
    "get_notifications",
    "update_notification_setting",
    "open_settings",
    "update_voice_setting",
    "connect_llm_key",
    "connect_kb_openapi",
    "unknown",
)
ALLOWED_SIDES = ("buy", "sell", "hold", "none")
AVAILABLE_CONDITIONS = ("ma_cross", "price_above_ma", "rsi_above", "rsi_below", "momentum")


def _safe_text(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _safe_int(value: object) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _safe_confidence(value: object) -> float:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        confidence = 0.5
    return min(max(confidence, 0.0), 1.0)


def _extract_json_object(text: str) -> dict | None:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r"\s*```$", "", cleaned).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start < 0 or end < start:
        return None
    try:
        data = json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


class LLMService:
    async def interpret(self, command: VoiceCommand) -> LLMIntent:
        config = secure_config.load_config()
        provider = config["llm"].get("provider") or secure_config.DEFAULT_LLM_PROVIDER
        if provider in ("openai", "openai_compatible"):
            if not (config["llm"].get("api_key") or "").strip():
                return self._provider_error(command, f"{provider} API key is not configured.")
            external = await self._call_openai_compatible(command, config["llm"], require_api_key=True)
            if external:
                return external
            return self._provider_error(command, f"{provider} call failed.")
        if provider == "anthropic":
            if not (config["llm"].get("api_key") or "").strip():
                return self._provider_error(command, "anthropic API key is not configured.")
            external = await self._call_anthropic(command, config["llm"])
            if external:
                return external
            return self._provider_error(command, "anthropic call failed.")
        if provider == "gemini":
            if not (config["llm"].get("api_key") or "").strip():
                return self._provider_error(command, "gemini API key is not configured.")
            external = await self._call_gemini(command, config["llm"])
            if external:
                return external
            return self._provider_error(command, "gemini call failed.")
        if provider == "local":
            if not (config["llm"].get("base_url") or "").strip():
                return self._provider_error(command, "local LLM base_url is not configured.")
            external = await self._call_openai_compatible(command, config["llm"], require_api_key=False)
            if external:
                return external
            return self._provider_error(command, "local LLM call failed.")
        return self._provider_error(command, f"Unsupported LLM provider: {provider}.")

    def _system_prompt(self) -> str:
        return (
            "You are a Korean financial assistant and intent parser. Return only one JSON object. "
            "The JSON must include these keys: intent, confidence, symbol_name, symbol_code, side, "
            "amount_krw, quantity, condition_type, condition_params, raw_summary, assistant_message, "
            "need_user_clarification, clarification_question, mode. "
            "assistant_message must be a concise Korean answer for the user. If the app has not provided "
            "live market/account data, say that you can guide analysis but cannot verify live data. "
            "Never ask for or output API keys, account numbers, tokens, passwords, PINs, or secrets."
        )

    def _user_payload(self, command: VoiceCommand) -> str:
        return json.dumps(
            {
                "utterance": command.text,
                "allowed_intents": list(ALLOWED_INTENTS),
                "available_conditions": list(AVAILABLE_CONDITIONS),
                "market_context": "domestic_stock",
                "screen": command.screen,
                "mode": command.mode,
                "privacy_rule": "do_not_request_or_output_sensitive_credentials",
            },
            ensure_ascii=False,
        )

    def _intent_json_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "intent": {"type": "string", "enum": list(ALLOWED_INTENTS)},
                "confidence": {"type": "number"},
                "symbol_name": {"type": ["string", "null"]},
                "symbol_code": {"type": ["string", "null"]},
                "side": {"type": "string", "enum": list(ALLOWED_SIDES)},
                "amount_krw": {"type": ["integer", "null"]},
                "quantity": {"type": ["integer", "null"]},
                "condition_type": {"type": ["string", "null"]},
                "condition_params": {"type": "object"},
                "raw_summary": {"type": "string"},
                "assistant_message": {"type": "string"},
                "need_user_clarification": {"type": "boolean"},
                "clarification_question": {"type": ["string", "null"]},
                "mode": {"type": "string"},
            },
            "required": ["intent", "confidence", "side", "condition_params", "raw_summary", "assistant_message"],
        }

    def _normalize_intent(self, data: dict, command: VoiceCommand, provider: str) -> LLMIntent | None:
        intent = data.get("intent")
        side = data.get("side")
        raw_summary = _safe_text(data.get("raw_summary")) or _safe_text(data.get("summary"))
        assistant_message = _safe_text(data.get("assistant_message")) or raw_summary
        if not raw_summary:
            raw_summary = f"{provider} 응답을 해석했습니다."
        if not assistant_message:
            assistant_message = raw_summary

        normalized = {
            "intent": intent if intent in ALLOWED_INTENTS else "unknown",
            "confidence": _safe_confidence(data.get("confidence")),
            "symbol_name": _safe_text(data.get("symbol_name")),
            "symbol_code": _safe_text(data.get("symbol_code")),
            "side": side if side in ALLOWED_SIDES else "none",
            "amount_krw": _safe_int(data.get("amount_krw")),
            "quantity": _safe_int(data.get("quantity")),
            "condition_type": _safe_text(data.get("condition_type")),
            "condition_params": data.get("condition_params") if isinstance(data.get("condition_params"), dict) else {},
            "raw_summary": raw_summary,
            "assistant_message": assistant_message,
            "need_user_clarification": bool(data.get("need_user_clarification", False)),
            "clarification_question": _safe_text(data.get("clarification_question")),
            "mode": command.mode,
        }
        try:
            return LLMIntent.model_validate(normalized)
        except ValidationError:
            return None

    def _parse_provider_text(self, text: str, command: VoiceCommand, provider: str) -> LLMIntent | None:
        data = _extract_json_object(text)
        if data is None:
            return None
        return self._normalize_intent(data, command, provider)

    async def _call_openai_compatible(
        self,
        command: VoiceCommand,
        llm_config: dict,
        require_api_key: bool = True,
    ) -> LLMIntent | None:
        api_key = (llm_config.get("api_key") or "").strip()
        if require_api_key and not api_key:
            return None

        base_url = (llm_config.get("base_url") or "https://api.openai.com/v1").rstrip("/")
        model = (llm_config.get("model") or "gpt-4.1-mini").strip()
        endpoint = f"{base_url}/chat/completions"
        provider = (llm_config.get("provider") or "openai").strip()
        payload = {
            "model": model,
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
            "messages": [
                {
                    "role": "system",
                    "content": self._system_prompt(),
                },
                {
                    "role": "user",
                    "content": self._user_payload(command),
                },
            ],
        }

        try:
            headers = {"Content-Type": "application/json"}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            async with httpx.AsyncClient(timeout=20.0) as client:
                try:
                    response = await client.post(endpoint, headers=headers, json=payload)
                    response.raise_for_status()
                except httpx.HTTPStatusError as error:
                    if error.response.status_code not in (400, 422):
                        raise
                    fallback_payload = {key: value for key, value in payload.items() if key != "response_format"}
                    response = await client.post(endpoint, headers=headers, json=fallback_payload)
                    response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            return self._parse_provider_text(content, command, provider)
        except (httpx.HTTPError, KeyError, IndexError, TypeError):
            return None

    async def _call_anthropic(self, command: VoiceCommand, llm_config: dict) -> LLMIntent | None:
        api_key = (llm_config.get("api_key") or "").strip()
        base_url = (llm_config.get("base_url") or "https://api.anthropic.com").rstrip("/")
        endpoint = f"{base_url}/messages" if base_url.endswith("/v1") else f"{base_url}/v1/messages"
        model = (llm_config.get("model") or "claude-3-5-sonnet-latest").strip()
        payload = {
            "model": model,
            "max_tokens": 1200,
            "temperature": 0.1,
            "system": self._system_prompt(),
            "messages": [{"role": "user", "content": self._user_payload(command)}],
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    endpoint,
                    headers={
                        "Content-Type": "application/json",
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                    },
                    json=payload,
                )
                response.raise_for_status()
            blocks = response.json()["content"]
            content = "".join(block.get("text", "") for block in blocks if isinstance(block, dict))
            return self._parse_provider_text(content, command, "anthropic")
        except (httpx.HTTPError, KeyError, TypeError):
            return None

    async def _call_gemini(self, command: VoiceCommand, llm_config: dict) -> LLMIntent | None:
        api_key = (llm_config.get("api_key") or "").strip()
        base_url = (llm_config.get("base_url") or "https://generativelanguage.googleapis.com/v1beta").rstrip("/")
        model = (llm_config.get("model") or "gemini-2.5-flash").strip()
        endpoint = f"{base_url}/models/{model}:generateContent"
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": f"{self._system_prompt()}\n\nInput:\n{self._user_payload(command)}"}],
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json",
            },
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    endpoint,
                    params={"key": api_key},
                    headers={"Content-Type": "application/json"},
                    json=payload,
                )
                response.raise_for_status()
            parts = response.json()["candidates"][0]["content"]["parts"]
            content = "".join(part.get("text", "") for part in parts if isinstance(part, dict))
            return self._parse_provider_text(content, command, "gemini")
        except (httpx.HTTPError, KeyError, IndexError, TypeError):
            return None

    def _provider_error(self, command: VoiceCommand, message: str) -> LLMIntent:
        return LLMIntent(
            intent="unknown",
            confidence=0.0,
            side="none",
            raw_summary=message,
            assistant_message=f"{message} 설정 화면에서 provider, API key, Base URL, model 값을 확인해 주세요.",
            need_user_clarification=True,
            clarification_question="LLM 설정 화면에서 provider, API key, base URL, model 값을 확인해 주세요.",
            mode=command.mode,
        )

llm_service = LLMService()

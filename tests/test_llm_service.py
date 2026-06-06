import asyncio

from backend.schemas.voice import VoiceCommand
from backend.services import secure_config
from backend.services.llm_service import LLMService


def _config(provider: str, api_key: str = "", base_url: str = "", model: str = "gpt-4.1-mini") -> dict:
    return {
        "llm": {
            "provider": provider,
            "api_key": api_key,
            "base_url": base_url,
            "model": model,
        },
        "kb": {},
        "security": {"live_enabled": False},
    }


def test_openai_without_key_exposes_provider_error(monkeypatch):
    monkeypatch.setattr(secure_config, "load_config", lambda: _config("openai"))

    intent = asyncio.run(LLMService().interpret(VoiceCommand(text="삼성전자 분석해줘", source="text")))

    assert intent.intent == "unknown"
    assert intent.confidence == 0
    assert "openai API key is not configured" in intent.raw_summary
    assert intent.assistant_message


def test_anthropic_without_key_exposes_provider_error(monkeypatch):
    monkeypatch.setattr(secure_config, "load_config", lambda: _config("anthropic"))

    intent = asyncio.run(LLMService().interpret(VoiceCommand(text="삼성전자 분석해줘", source="text")))

    assert intent.intent == "unknown"
    assert "anthropic API key is not configured" in intent.raw_summary
    assert "not implemented" not in intent.raw_summary


def test_provider_json_response_is_normalized_for_chat_message():
    intent = LLMService()._parse_provider_text(
        """
        {
          "intent": "get_market_briefing",
          "confidence": 0.82,
          "side": "none",
          "condition_params": {},
          "raw_summary": "시장 브리핑 요청으로 분류했습니다.",
          "assistant_message": "현재 제공된 앱 데이터 기준으로 시장 브리핑을 정리해드릴게요."
        }
        """,
        VoiceCommand(text="오늘 시장 브리핑 알려줘", source="text"),
        "openai",
    )

    assert intent is not None
    assert intent.intent == "get_market_briefing"
    assert intent.assistant_message == "현재 제공된 앱 데이터 기준으로 시장 브리핑을 정리해드릴게요."

"""Schemas for local assistant configuration."""

from typing import Literal

from pydantic import BaseModel, Field


class LLMConfigRequest(BaseModel):
    provider: Literal["openai", "anthropic", "gemini", "openai_compatible", "local"] = "openai"
    api_key: str | None = Field(default=None, max_length=8192)
    base_url: str | None = Field(default=None, max_length=512)
    model: str | None = Field(default=None, max_length=128)


BrokerProvider = Literal[
    "kb",
    "korea_investment",
    "mirae_asset",
    "nh",
    "samsung",
    "kiwoom",
    "shinhan",
    "daishin",
    "hana",
    "custom",
]


class KBConfigRequest(BaseModel):
    broker: BrokerProvider | None = "kb"
    api_key: str | None = Field(default=None, max_length=8192)
    api_secret: str | None = Field(default=None, max_length=8192)
    account: str | None = Field(default=None, max_length=64)
    product_code: str | None = Field(default=None, max_length=16)
    base_url: str | None = Field(default=None, max_length=512)


class ConfigStatus(BaseModel):
    llm_provider: str
    llm_model: str | None = None
    llm_base_url: str | None = None
    llm_key_registered: bool
    llm_key_masked: str | None = None
    kb_key_registered: bool
    kb_secret_registered: bool
    kb_key_masked: str | None = None
    kb_account_masked: str | None = None
    broker_provider: str | None = "kb"
    broker_name: str | None = "KB증권"
    kb_base_url: str | None = None
    live_enabled: bool = False


class ConfigUpdateResponse(BaseModel):
    status: str = "success"
    message: str
    config: ConfigStatus


class KBConnectionTestResponse(BaseModel):
    status: Literal["success", "missing", "failed"]
    message: str
    base_url: str
    token_received: bool = False
    raw_response_masked: dict | None = None

"""Schemas for local action execution stubs."""

from typing import Any, Literal

from pydantic import BaseModel, Field


class ActionExecuteRequest(BaseModel):
    intent: str
    action_plan: list[dict[str, Any]] = Field(default_factory=list)
    confirmed: bool = False
    auth_token: str | None = None


class ActionExecuteResponse(BaseModel):
    status: Literal["success", "pending_confirmation", "requires_auth", "rejected", "error"]
    message: str
    data: dict[str, Any] = Field(default_factory=dict)

"""Sensitive-value masking helpers."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

SENSITIVE_FRAGMENTS = (
    "api_key",
    "apikey",
    "secret",
    "token",
    "password",
    "passwd",
    "pin",
    "account",
    "acct",
    "authorization",
    "user_info",
)


def mask_value(value: Any, visible: int = 4, masked_length: int = 8) -> Any:
    if value is None:
        return None
    text = str(value)
    if not text:
        return ""
    if len(text) <= visible:
        return "*" * len(text)
    return f"{text[:visible]}{'*' * masked_length}"


def is_sensitive_key(key: str) -> bool:
    normalized = key.lower().replace("-", "_")
    return any(fragment in normalized for fragment in SENSITIVE_FRAGMENTS)


def mask_sensitive(data: Any) -> Any:
    if isinstance(data, Mapping):
        masked: dict[str, Any] = {}
        for key, value in data.items():
            key_text = str(key)
            masked[key_text] = mask_value(value) if is_sensitive_key(key_text) else mask_sensitive(value)
        return masked

    if isinstance(data, Sequence) and not isinstance(data, (str, bytes, bytearray)):
        return [mask_sensitive(item) for item in data]

    return data

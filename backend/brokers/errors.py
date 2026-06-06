"""Broker adapter errors."""

from __future__ import annotations


class BrokerError(Exception):
    def __init__(self, message: str, broker: str | None = None, feature: str | None = None):
        super().__init__(message)
        self.broker = broker
        self.feature = feature
        self.message = message

    def to_response(self) -> dict:
        return {
            "status": "error",
            "broker": self.broker,
            "feature": self.feature,
            "message": self.message,
        }


class NotConfiguredError(BrokerError):
    def __init__(self, broker: str, feature: str):
        super().__init__(
            "공식 구현서 또는 endpoint mapping이 없어 아직 구현할 수 없습니다. "
            f"docs/brokers/{broker} 또는 config/brokers/{broker}/endpoints.yaml을 먼저 채워주세요.",
            broker=broker,
            feature=feature,
        )

    def to_response(self) -> dict:
        response = super().to_response()
        response["status"] = "not_configured"
        return response

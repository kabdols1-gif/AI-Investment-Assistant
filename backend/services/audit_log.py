"""Masked audit log writer for assistant events."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from backend.services.masking import mask_sensitive
from backend.services.secure_config import CONFIG_DIR


AUDIT_DIR = CONFIG_DIR / "audit_logs"


def append_audit_event(event: str, payload: dict[str, Any]) -> None:
    AUDIT_DIR.mkdir(parents=True, exist_ok=True)
    today = datetime.now().strftime("%Y%m%d")
    path = AUDIT_DIR / f"{today}.jsonl"
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event": event,
        "payload": mask_sensitive(payload),
        "sensitive_masked": True,
    }
    with path.open("a", encoding="utf-8") as file:
        file.write(json.dumps(record, ensure_ascii=False) + "\n")


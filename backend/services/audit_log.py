"""Masked audit log writer for assistant events."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
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


def read_audit_events(
    *,
    event_prefix: str | None = None,
    limit: int = 100,
    days: int = 7,
) -> list[dict[str, Any]]:
    if not AUDIT_DIR.exists():
        return []

    safe_limit = max(1, min(limit, 500))
    safe_days = max(1, min(days, 30))
    today = datetime.now()
    events: list[dict[str, Any]] = []

    for offset in range(safe_days):
        day = today - timedelta(days=offset)
        path = AUDIT_DIR / f"{day.strftime('%Y%m%d')}.jsonl"
        if not path.exists():
            continue
        with path.open("r", encoding="utf-8") as file:
            for line in file:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                except json.JSONDecodeError:
                    continue
                event_name = str(record.get("event") or "")
                if event_prefix and not event_name.startswith(event_prefix):
                    continue
                events.append(record)

    events.sort(key=lambda item: str(item.get("timestamp") or ""), reverse=True)
    return events[:safe_limit]

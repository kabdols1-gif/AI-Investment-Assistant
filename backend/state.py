"""Trading authentication state for the Strategy Builder."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

import kb_auth as ka

logger = logging.getLogger(__name__)


class TradingState:
    """Manage trading authentication state for the UI backend.

    The frontend still uses the original two mode values:
    - ``vps``: development/paper-like trading config
    - ``prod``: production trading config
    """

    MODE_SWITCH_COOLDOWN = 60

    def __init__(self):
        self._authenticated = False
        self._current_mode = ka.read_mode()
        self._last_mode_switch: Optional[datetime] = None
        self._try_restore_auth()

    def _try_restore_auth(self) -> None:
        token_data = ka.read_token_data()
        if not token_data:
            return
        mode = token_data.get("mode", self._current_mode)
        try:
            ka.auth(svr=mode)
            self._authenticated = True
            self._current_mode = mode
            ka.save_mode(mode)
            logger.info("Trading authentication restored (mode=%s)", mode)
        except Exception as exc:
            logger.info("Trading authentication restore failed: %s", exc)
            self._authenticated = False

    def authenticate(self, mode: str = "vps") -> bool:
        if mode not in ("vps", "prod"):
            raise ValueError("mode must be 'vps' or 'prod'")

        switching_mode = self._authenticated and self._current_mode != mode
        if switching_mode:
            can_switch, remaining = self.can_switch_mode()
            if not can_switch:
                raise Exception(f"Mode can be switched once per minute. Try again in {remaining}s.")
            ka.clear_token()
            self._authenticated = False

        ka.auth(svr=mode)
        self._authenticated = True
        self._current_mode = mode
        if switching_mode:
            self._last_mode_switch = datetime.now()
        ka.save_mode(mode)
        return True

    def can_switch_mode(self) -> tuple[bool, int]:
        if self._last_mode_switch is None:
            return True, 0
        elapsed = (datetime.now() - self._last_mode_switch).total_seconds()
        remaining = max(0, int(self.MODE_SWITCH_COOLDOWN - elapsed))
        return remaining == 0, remaining

    def logout(self) -> None:
        try:
            ka.revoke_token(mode=self._current_mode)
        except Exception as exc:
            logger.info("Trading token revoke skipped/failed: %s", exc)
        ka.clear_token()
        ka.delete_mode()
        self._authenticated = False

    @property
    def is_authenticated(self) -> bool:
        if not self._authenticated:
            return False
        return bool(ka.getTREnv().access_token)

    @property
    def current_mode(self) -> str:
        return self._current_mode

    @property
    def mode_display(self) -> str:
        return "개발 모드" if self._current_mode == "vps" else "실전 모드"

    @property
    def cooldown_remaining(self) -> int:
        _, remaining = self.can_switch_mode()
        return remaining

    def get_status(self) -> dict:
        file_mode = ka.read_mode()
        if file_mode != self._current_mode:
            self._current_mode = file_mode
            self._authenticated = bool(ka.read_token_data())

        can_switch, remaining = self.can_switch_mode()
        trenv = ka.getTREnv()
        return {
            "authenticated": self.is_authenticated,
            "mode": self._current_mode,
            "mode_display": self.mode_display,
            "account": trenv.account,
            "can_switch_mode": can_switch,
            "cooldown_remaining": remaining,
        }


trading_state = TradingState()

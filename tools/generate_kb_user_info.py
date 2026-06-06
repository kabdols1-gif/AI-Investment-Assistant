"""Generate KB BaaS encrypted user_info and save it to kb_devlp.yaml.

Usage:
    python tools/generate_kb_user_info.py --mode prod --plain "9912311|홍길동|01012345678|1"

The PBKDF2/AES logic follows sample/2.PBKDF2.java and sample/2.AES256.java.
"""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import kb_auth  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["dev", "prod"], default="prod")
    parser.add_argument(
        "--plain",
        required=True,
        help="Plain user info, e.g. birth+gender|name|phone|1",
    )
    args = parser.parse_args()

    cfg = kb_auth.load_config()
    mode_cfg = cfg[args.mode]
    ci_no = mode_cfg.get("ci_no", "")
    ci_secret = mode_cfg.get("ci_secret", "")

    if not ci_no or not ci_secret:
        raise SystemExit(f"{args.mode}.ci_no and {args.mode}.ci_secret must be set first.")

    encrypted = kb_auth.encrypt_user_info(args.plain, ci_no, ci_secret)
    mode_cfg["user_info"] = encrypted
    mode_cfg["user_info_plain"] = ""

    kb_auth.CONFIG_FILE.write_text(
        yaml.safe_dump(cfg, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )
    print(f"Saved encrypted user_info for {args.mode} to {kb_auth.CONFIG_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""
mymore-summary — Stop Hook

在会话结束时触发。如果会话有有效 ID，记录会话摘要；
否则跳过摘要记录（避免产生"会话结束于xxx"的无用数据）。
始终运行 consolidate 归档过期记忆。"""

import json
import os
import subprocess
import time
from pathlib import Path


def _project_root():
    return Path(__file__).resolve().parent.parent.parent.parent


def _call_mymore(payload: dict) -> None:
    json_input = json.dumps(payload, ensure_ascii=False) + "\n"
    try:
        subprocess.run(
            ["docker", "compose", "run", "--rm", "-T", "mymore-mcp"],
            input=json_input,
            capture_output=True,
            text=True,
            cwd=str(_project_root()),
            timeout=30,
        )
    except Exception:
        pass


def main():
    session_id = os.environ.get("CLAUDE_SESSION_ID", "").strip()

    # 仅在 session_id 有效时记录摘要
    if session_id and session_id != "unknown":
        ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        add_payload = {
            "jsonrpc": "2.0",
            "id": f"stop-add-{int(time.time())}",
            "method": "tools/call",
            "params": {
                "name": "add_memory",
                "arguments": {
                    "content": f"会话: {session_id} 结束于 {ts}",
                    "owner_id": "dante926",
                    "category": "session",
                    "track": "user",
                    "session_id": session_id,
                },
            },
        }
        _call_mymore(add_payload)

    # always consolidate
    con_payload = {
        "jsonrpc": "2.0",
        "id": f"stop-con-{int(time.time())}",
        "method": "tools/call",
        "params": {
            "name": "consolidate",
            "arguments": {"owner_id": "dante926", "days": 7, "dry_run": False},
        },
    }
    _call_mymore(con_payload)


if __name__ == "__main__":
    main()

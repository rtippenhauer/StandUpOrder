import json
import os
from datetime import datetime
from typing import Any, Dict

LOG_FILE = "standup_log.json"


def append_session_log(data_path: str, entry: Dict[str, Any]):
    """Append a session entry to the log file. Creates file if it doesn't exist."""
    log_path = os.path.join(data_path, LOG_FILE)
    entry["logged_at"] = datetime.now().isoformat()

    # Read existing log
    logs: list = []
    if os.path.exists(log_path):
        try:
            with open(log_path, "r", encoding="utf-8") as f:
                logs = json.load(f)
            if not isinstance(logs, list):
                logs = []
        except (json.JSONDecodeError, OSError):
            logs = []

    logs.append(entry)

    # Atomic write
    tmp = log_path + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(logs, f, indent=2, ensure_ascii=False)
        os.replace(tmp, log_path)
    except OSError as e:
        raise RuntimeError(f"Failed to write session log: {e}") from e

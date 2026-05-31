import json
import os
import shutil
from typing import Any, Dict

SETTINGS_FILE = "settings.json"
BACKUP_FILE = "settings.json.backup"

DEFAULT_SETTINGS: Dict[str, Any] = {
    "pods": {
        "pod_1": {"name": "Stand-Up Team", "abbreviation": "TEAM"}
    },
    "people_groups": {},
    "default_pod": "pod_1",
    "timer_minutes": 2,
    "timer_enabled": True,
    "theme": "auto",
    "holiday_lead_days": 20,
}


class SettingsStore:
    def __init__(self, data_path: str):
        self.data_path = data_path
        self.settings_path = os.path.join(data_path, SETTINGS_FILE)
        self.backup_path = os.path.join(data_path, BACKUP_FILE)

    def initialize(self):
        os.makedirs(self.data_path, exist_ok=True)
        if not os.path.exists(self.settings_path):
            data = dict(DEFAULT_SETTINGS)
        else:
            data = self._read_raw()

        # Always import people.json if it exists (not yet renamed to .imported)
        # This runs on every startup until the file is consumed
        imported = self._import_people_json(data)
        migrated = self._migrate_if_needed(data)
        if imported or migrated or not os.path.exists(self.settings_path):
            self._write(data)

    def _import_people_json(self, data: Dict[str, Any]) -> bool:
        """Import people_groups from a legacy people.json file if one exists in the data directory."""
        people_path = os.path.join(self.data_path, "people.json")
        if not os.path.exists(people_path):
            return False
        try:
            with open(people_path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            people = raw.get("people_groups", {})
            if not people:
                return False
            data["people_groups"] = people
            # Rename so we don't re-import on next startup
            os.rename(people_path, people_path + ".imported")
            print(f"[settings] Imported {len(people)} people from people.json")
            return True
        except (json.JSONDecodeError, OSError) as e:
            print(f"[settings] Could not import people.json: {e}")
            return False

    def load(self) -> Dict[str, Any]:
        data = self._read_raw()
        # Ensure all expected keys exist
        for key, val in DEFAULT_SETTINGS.items():
            if key not in data:
                data[key] = val
        return data

    def save(self, data: Dict[str, Any]):
        # Merge with existing to preserve unknown keys
        existing = self._read_raw()
        existing.update(data)
        self._write(existing)

    def update_partial(self, updates: Dict[str, Any]):
        data = self.load()
        data.update(updates)
        self._write(data)

    def _read_raw(self) -> Dict[str, Any]:
        try:
            with open(self.settings_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return dict(DEFAULT_SETTINGS)

    def _write(self, data: Dict[str, Any]):
        tmp_path = self.settings_path + ".tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(tmp_path, self.settings_path)

    def _migrate_if_needed(self, data: Dict[str, Any]) -> bool:
        """Migrate integer-based group IDs to pod ID strings. Returns True if migration was needed."""
        people = data.get("people_groups", {})
        if not people:
            return False

        # Check if any person has integer group IDs
        needs_migration = any(
            isinstance(v, list) and len(v) > 0 and isinstance(v[0], int)
            for v in people.values()
        )
        if not needs_migration:
            return False

        # Backup original
        shutil.copy2(self.settings_path, self.backup_path)

        # Build pod mapping: integer -> pod_id string
        all_group_ids: set = set()
        for pod_ids in people.values():
            if isinstance(pod_ids, list):
                for gid in pod_ids:
                    if isinstance(gid, int):
                        all_group_ids.add(gid)

        group_map = {gid: f"pod_{gid}" for gid in sorted(all_group_ids)}

        # Migrate pods
        if "pods" not in data:
            data["pods"] = {}
        for gid, pod_id in group_map.items():
            if pod_id not in data["pods"]:
                data["pods"][pod_id] = {
                    "name": f"Group {gid}",
                    "abbreviation": f"G{gid}",
                }

        # Migrate people_groups
        new_people: Dict[str, list] = {}
        for name, pod_ids in people.items():
            if isinstance(pod_ids, list):
                new_people[name] = [
                    group_map.get(gid, f"pod_{gid}") if isinstance(gid, int) else gid
                    for gid in pod_ids
                ]
            else:
                new_people[name] = pod_ids
        data["people_groups"] = new_people

        # Set default pod to pod_1 if not already set
        if "default_pod" not in data and "pod_1" in data["pods"]:
            data["default_pod"] = "pod_1"

        return True

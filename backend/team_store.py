"""
Per-team data isolation.
Each team lives in /data/teams/{slug}/
Global data (invites, team registry) lives in /data/teams/_global/
"""
import json
import os
import shutil
from typing import Any, Dict, List, Optional

TEAMS_ROOT = "teams"
GLOBAL_DIR = "_global"
TEAM_REGISTRY_FILE = "teams.json"
INVITES_FILE = "invites.json"

VALID_SLUG_CHARS = set("abcdefghijklmnopqrstuvwxyz0123456789-_")

DEFAULT_TEAM_SETTINGS: Dict[str, Any] = {
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

KNOWN_TEAMS = ["ndt", "qmanage", "release", "mobile"]


def validate_slug(slug: str) -> bool:
    return bool(slug) and all(c in VALID_SLUG_CHARS for c in slug) and len(slug) <= 32


class TeamStore:
    def __init__(self, data_path: str):
        self.data_path = data_path
        self.teams_root = os.path.join(data_path, TEAMS_ROOT)
        self.global_dir = os.path.join(self.teams_root, GLOBAL_DIR)

    # ── Initialization ────────────────────────────────────────────────────

    def initialize(self):
        """Create directory structure, migrate legacy data to ndt, seed known teams."""
        os.makedirs(self.global_dir, exist_ok=True)

        # Migrate legacy flat /data/settings.json → /data/teams/ndt/
        self._migrate_legacy_to_ndt()

        # Ensure all known teams exist
        for slug in KNOWN_TEAMS:
            self._ensure_team_dir(slug)

        # Ensure ndt exists in team registry
        registry = self.load_registry()
        changed = False
        defaults = {
            "ndt": "NDT",
            "qmanage": "QManage",
            "release": "Release",
            "mobile": "Mobile",
        }
        for slug, name in defaults.items():
            if slug not in registry:
                registry[slug] = {"name": name, "slug": slug}
                changed = True
        if changed:
            self._save_registry(registry)

    def _ensure_team_dir(self, slug: str):
        team_dir = self.team_path(slug)
        os.makedirs(team_dir, exist_ok=True)
        settings_path = os.path.join(team_dir, "settings.json")
        if not os.path.exists(settings_path):
            self._write_json(settings_path, dict(DEFAULT_TEAM_SETTINGS))

    def _migrate_legacy_to_ndt(self):
        """One-time migration: copy legacy /data/settings.json etc → /data/teams/ndt/"""
        legacy_settings = os.path.join(self.data_path, "settings.json")
        ndt_dir = self.team_path("ndt")
        ndt_settings = os.path.join(ndt_dir, "settings.json")

        if not os.path.exists(legacy_settings):
            return
        if os.path.exists(ndt_settings):
            return  # Already migrated

        os.makedirs(ndt_dir, exist_ok=True)

        # Copy settings
        shutil.copy2(legacy_settings, ndt_settings)
        os.rename(legacy_settings, legacy_settings + ".migrated")
        print("[team_store] Migrated legacy settings.json → teams/ndt/settings.json")

        # Copy timeoff files
        for fname in ["timeoff.json", "timeoff_entries.json", "facts_cache.json",
                       "standup_log.json", "settings.json.backup"]:
            src = os.path.join(self.data_path, fname)
            if os.path.exists(src):
                shutil.copy2(src, os.path.join(ndt_dir, fname))
                os.rename(src, src + ".migrated")
                print(f"[team_store] Migrated {fname} → teams/ndt/{fname}")

    # ── Paths ─────────────────────────────────────────────────────────────

    def team_path(self, slug: str) -> str:
        return os.path.join(self.teams_root, slug)

    def team_settings_path(self, slug: str) -> str:
        return os.path.join(self.team_path(slug), "settings.json")

    # ── Team Registry ─────────────────────────────────────────────────────

    def load_registry(self) -> Dict[str, Dict]:
        path = os.path.join(self.global_dir, TEAM_REGISTRY_FILE)
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {}

    def _save_registry(self, registry: Dict):
        path = os.path.join(self.global_dir, TEAM_REGISTRY_FILE)
        self._write_json(path, registry)

    def get_team(self, slug: str) -> Optional[Dict]:
        return self.load_registry().get(slug)

    def team_exists(self, slug: str) -> bool:
        return slug in self.load_registry()

    def create_team(self, slug: str, name: str) -> Dict:
        registry = self.load_registry()
        if slug in registry:
            raise ValueError(f"Team '{slug}' already exists")
        if not validate_slug(slug):
            raise ValueError("Invalid slug — use lowercase letters, numbers, hyphens, underscores only")
        registry[slug] = {"name": name, "slug": slug}
        self._save_registry(registry)
        self._ensure_team_dir(slug)
        return registry[slug]

    def update_team(self, slug: str, name: str) -> Dict:
        registry = self.load_registry()
        if slug not in registry:
            raise ValueError(f"Team '{slug}' not found")
        registry[slug]["name"] = name
        self._save_registry(registry)
        return registry[slug]

    def delete_team(self, slug: str):
        registry = self.load_registry()
        if slug not in registry:
            raise ValueError(f"Team '{slug}' not found")
        del registry[slug]
        self._save_registry(registry)
        # Optionally archive rather than delete
        team_dir = self.team_path(slug)
        archive = team_dir + ".archived"
        if os.path.exists(team_dir):
            os.rename(team_dir, archive)

    def list_teams(self) -> List[Dict]:
        return list(self.load_registry().values())

    # ── Per-Team Settings ─────────────────────────────────────────────────

    def load_settings(self, slug: str) -> Dict[str, Any]:
        self._ensure_team_dir(slug)
        path = self.team_settings_path(slug)
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            data = {}
        # Fill defaults
        for key, val in DEFAULT_TEAM_SETTINGS.items():
            if key not in data:
                data[key] = val
        # Run pod migration if needed
        self._migrate_pods_if_needed(data)
        return data

    def save_settings(self, slug: str, data: Dict[str, Any]):
        self._ensure_team_dir(slug)
        path = self.team_settings_path(slug)
        existing = self.load_settings(slug)
        existing.update(data)
        self._write_json(path, existing)

    def _migrate_pods_if_needed(self, data: Dict[str, Any]) -> bool:
        """Migrate integer group IDs → pod_N strings (same logic as old SettingsStore)."""
        people = data.get("people_groups", {})
        if not people:
            return False
        needs_migration = any(
            isinstance(v, list) and len(v) > 0 and isinstance(v[0], int)
            for v in people.values()
        )
        if not needs_migration:
            return False

        all_group_ids: set = set()
        for pod_ids in people.values():
            if isinstance(pod_ids, list):
                for gid in pod_ids:
                    if isinstance(gid, int):
                        all_group_ids.add(gid)

        group_map = {gid: f"pod_{gid}" for gid in sorted(all_group_ids)}

        if "pods" not in data:
            data["pods"] = {}
        for gid, pod_id in group_map.items():
            if pod_id not in data["pods"]:
                data["pods"][pod_id] = {"name": f"Group {gid}", "abbreviation": f"G{gid}"}

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

        if "default_pod" not in data and "pod_1" in data["pods"]:
            data["default_pod"] = "pod_1"
        return True

    # ── Invites ───────────────────────────────────────────────────────────

    def load_invites(self) -> List[Dict]:
        path = os.path.join(self.global_dir, INVITES_FILE)
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, list) else []
        except (FileNotFoundError, json.JSONDecodeError):
            return []

    def save_invites(self, invites: List[Dict]):
        path = os.path.join(self.global_dir, INVITES_FILE)
        self._write_json(path, invites)

    def add_invite(self, invite: Dict):
        invites = self.load_invites()
        invites.append(invite)
        self.save_invites(invites)

    def get_invite(self, token: str) -> Optional[Dict]:
        for inv in self.load_invites():
            if inv.get("token") == token:
                return inv
        return None

    def revoke_invite(self, token: str) -> bool:
        invites = self.load_invites()
        new_invites = [i for i in invites if i.get("token") != token]
        if len(new_invites) == len(invites):
            return False
        self.save_invites(new_invites)
        return True

    def consume_invite(self, token: str) -> Optional[Dict]:
        """Mark invite as used and return it, or None if invalid/expired."""
        from datetime import datetime
        invites = self.load_invites()
        now = datetime.utcnow().isoformat()
        for i, inv in enumerate(invites):
            if inv.get("token") == token:
                if inv.get("used"):
                    return None
                if inv.get("expires_at") and inv["expires_at"] < now:
                    return None
                invites[i]["used"] = True
                invites[i]["used_at"] = now
                self.save_invites(invites)
                return inv
        return None

    # ── Managers (authorized Google users per team) ───────────────────────

    def get_managers(self, slug: str) -> List[str]:
        data = self.load_settings(slug)
        return data.get("managers", [])

    def add_manager(self, slug: str, email: str):
        data = self.load_settings(slug)
        managers = data.setdefault("managers", [])
        if email not in managers:
            managers.append(email)
            self.save_settings(slug, data)

    def remove_manager(self, slug: str, email: str):
        data = self.load_settings(slug)
        managers = data.get("managers", [])
        data["managers"] = [m for m in managers if m != email]
        self.save_settings(slug, data)

    def is_manager(self, slug: str, email: str) -> bool:
        return email in self.get_managers(slug)

    # ── Helpers ───────────────────────────────────────────────────────────

    def _write_json(self, path: str, data: Any):
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(tmp, path)

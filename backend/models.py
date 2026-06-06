from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class PodCreate(BaseModel):
    name: str
    abbreviation: Optional[str] = None


class PersonCreate(BaseModel):
    name: str
    pod_ids: Optional[List[str]] = []


class PersonUpdate(BaseModel):
    new_name: Optional[str] = None
    pod_ids: Optional[List[str]] = None


class SessionLogEntry(BaseModel):
    pod_id: str
    pod_name: str
    members: List[Dict[str, Any]]  # [{name, position, absent, pto}]


class SettingsUpdate(BaseModel):
    default_pod: Optional[str] = None
    timer_minutes: Optional[int] = None
    timer_enabled: Optional[bool] = None
    theme: Optional[str] = None
    holiday_lead_days: Optional[int] = None
    facts_national_days_count: Optional[int] = None
    facts_on_this_day_count: Optional[int] = None
    facts_birthdays_count: Optional[int] = None
    facts_trivia_count: Optional[int] = None

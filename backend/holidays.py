"""US federal and common holidays for workday calculations."""
from datetime import date, timedelta

# Fixed-date holidays (month, day)
_FIXED = [
    (1, 1),   # New Year's Day
    (7, 4),   # Independence Day
    (12, 24), # Christmas Eve
    (12, 25), # Christmas Day
    (12, 31), # New Year's Eve
]


def get_us_holidays(year: int) -> set[date]:
    h: set[date] = set()

    # Fixed holidays
    for month, day in _FIXED:
        h.add(date(year, month, day))

    # MLK Day — 3rd Monday of January
    h.add(_nth_weekday(year, 1, 0, 3))

    # Presidents Day — 3rd Monday of February
    h.add(_nth_weekday(year, 2, 0, 3))

    # Memorial Day — last Monday of May
    h.add(_last_weekday(year, 5, 0))

    # Labor Day — 1st Monday of September
    h.add(_nth_weekday(year, 9, 0, 1))

    # Thanksgiving — 4th Thursday of November
    thanksgiving = _nth_weekday(year, 11, 3, 4)
    h.add(thanksgiving)

    # Day after Thanksgiving
    h.add(thanksgiving + timedelta(days=1))

    return h


def is_workday(d: date, holidays: set[date] | None = None) -> bool:
    if holidays is None:
        holidays = get_us_holidays(d.year)
    return d.weekday() < 5 and d not in holidays


def workdays_from(start: date, num_days: int) -> list[date]:
    """Return list of num_days workdays starting from start (inclusive)."""
    # Pre-load holidays for the relevant years
    holidays = get_us_holidays(start.year)
    if num_days > 200:  # safety cap
        num_days = 200
    result: list[date] = []
    current = start
    while len(result) < num_days:
        if current.weekday() >= 5:
            pass
        elif current in holidays:
            pass
        else:
            result.append(current)
        current += timedelta(days=1)
        # Load next year's holidays if we roll over
        if current.year != start.year and current.year not in {d.year for d in holidays}:
            holidays |= get_us_holidays(current.year)
    return result


def _nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    """Return the nth occurrence of weekday (0=Mon) in year/month."""
    d = date(year, month, 1)
    days_ahead = (weekday - d.weekday()) % 7
    first = d + timedelta(days=days_ahead)
    return first + timedelta(weeks=n - 1)


def _last_weekday(year: int, month: int, weekday: int) -> date:
    """Return the last occurrence of weekday (0=Mon) in year/month."""
    if month == 12:
        last = date(year, 12, 31)
    else:
        last = date(year, month + 1, 1) - timedelta(days=1)
    days_back = (last.weekday() - weekday) % 7
    return last - timedelta(days=days_back)

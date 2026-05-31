# Stand-Up Order Generator

A web-based daily stand-up order randomizer for development teams, designed to run in Docker on Unraid (or anywhere else).

## Features

- **Multi-Pod support** — manage multiple teams from one install; switch mid-session
- **Numbered tiles** — each person's shuffled position is prominent and screenshot-ready
- **Keyboard navigation** — Space or → to advance the current speaker highlight
- **Per-person timer** — configurable countdown (default 2 min), advisory only
- **Remove from session** — ✕ on any tile removes them today; Add Back via menu
- **Session date picker** — preview any future date's lineup with time-off applied
- **Daily facts panel** — National Days (nationaltoday.com), On This Day, Famous Birthdays, Fun Trivia
- **Screenshot** — renders tile grid + facts strip to PNG; copy to clipboard or download for Teams
- **Holiday themes** — auto-selects color palette near upcoming holidays (Halloween, Christmas, Summer Solstice, Easter, and more)
- **Auth gate** — username/password protects all management features; main stand-up view stays public
- **Time Off Calendar** — monthly calendar showing who's out, click any day for details
- **ADP PDF import** — upload "My Team Time Off Request" PDF; auto-matches names (Gabriel→Gabe, Zachary→Zach, etc.)
- **Manual time off** — add anyone not in ADP with start date + workday count (skips weekends and US holidays)
- **US holiday calendar** — MLK Day, Memorial Day, July 4th, Labor Day, Thanksgiving, Christmas, etc.
- **Session log** — every shuffle is logged to `standup_log.json`
- **Backward compatible** — auto-migrates old integer group ID settings

## Quick Start

### Docker Compose

```bash
cp .env.example .env    # edit if needed
docker compose up -d
# Open http://localhost:8080
```

On first launch you'll be prompted to create an admin account.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Host port to expose |
| `DATA_PATH` | `./data` | Host path for persistent data |
| `PUID` | `1000` | User ID for file ownership |
| `PGID` | `1000` | Group ID for file ownership |
| `TZ` | `America/New_York` | Timezone |

## Unraid

Use `unraid-community-template.xml` to import the container template.
Image: `rtippenhauer/standup-order-generator:latest`

## Development

### Backend (FastAPI + Python 3.12)

```bash
cd backend
pip install -r requirements.txt
DATA_PATH=./data python main.py
```

### Frontend (React + Vite + Tailwind)

```bash
cd frontend
npm install
npm run dev    # proxies /api to localhost:8080
```

### Build & Push

```bash
docker compose build --no-cache
docker build -t rtippenhauer/standup-order-generator:latest .
docker push rtippenhauer/standup-order-generator:latest
```

## Data Files

All state lives in `DATA_PATH` (default `./data`):

| File | Contents |
|---|---|
| `settings.json` | Pods, people, assignments, users, app config |
| `timeoff.json` | Auto-remove schedule (rebuilt from entries) |
| `timeoff_entries.json` | Full time-off entry metadata |
| `standup_log.json` | Append-only session history |
| `facts_cache.json` | Daily facts cache (multi-date, per-date key) |

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` or `→` | Advance to next speaker |
| `✕` on tile | Remove person from today's session |

## ADP Time Off Import

1. In ADP: **My Team → Reports & Analytics → My Team Time Off Request**
2. Run report, download PDF
3. In app: **⚙️ Manage → Import ADP PDF**
4. Upload PDF — names are auto-matched (nicknames resolved automatically)
5. Confirm and save — entries appear in the Time Off Calendar immediately

## Tech Stack

- **Backend**: FastAPI, Python 3.12, pdfplumber, bcrypt
- **Frontend**: React 18, Vite, Tailwind CSS
- **Container**: Docker multi-stage build, PUID/PGID support (linuxserver.io pattern)

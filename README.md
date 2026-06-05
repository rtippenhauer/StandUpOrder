# Stand-Up Order Generator

Randomizes daily stand-up speaking order for multiple teams. Hosted in Docker, shared via URL.

## Quick Start

```bash
cp .env.example .env
# Fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BASE_URL, SUPER_ADMIN_EMAIL
docker compose up -d --build
```

---

## Google OAuth Setup (Required)

You need a Google Cloud project with OAuth credentials before the app will allow anyone to sign in.

### Step 1 — Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown at the top → **New Project**
3. Name it (e.g. `StandUp`) → **Create**
4. Make sure the new project is selected in the dropdown

### Step 2 — Enable the People / UserInfo API

1. In the left sidebar → **APIs & Services** → **Enabled APIs & Services**
2. Click **+ Enable APIs and Services**
3. Search for `Google People API` → click it → **Enable**
   - (The basic email/profile scope works without this, but enabling it is best practice)

### Step 3 — Configure the OAuth Consent Screen

1. Left sidebar → **APIs & Services** → **OAuth consent screen**
2. Select **External** → **Create**
3. Fill in:
   - **App name**: `Stand-Up Order Generator` (or any name)
   - **User support email**: your Gmail
   - **Developer contact email**: your Gmail
4. Click **Save and Continue** through Scopes (no extra scopes needed — email + profile are included by default)
5. On **Test users**: click **+ Add Users** and add:
   - `rtippenhauer@gmail.com` (your super admin account)
   - Any other Gmail accounts you want to invite as managers
   > ⚠️ While the app is in "Testing" mode, only listed test users can sign in. You can add more later or publish the app.
6. **Save and Continue** → **Back to Dashboard**

### Step 4 — Create OAuth 2.0 Credentials

1. Left sidebar → **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `StandUp App`
5. Under **Authorized redirect URIs**, click **+ Add URI** and enter:
   ```
   https://standup.rtippenhauer.com/api/auth/callback
   ```
   Replace with your actual `BASE_URL`. If testing locally:
   ```
   http://localhost:8080/api/auth/callback
   ```
   > You can add both. Google allows multiple redirect URIs.
6. Click **Create**
7. A popup shows your **Client ID** and **Client Secret** — copy both immediately

### Step 5 — Configure Environment Variables

In your `.env` file (or Unraid template):

```env
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret-here
BASE_URL=https://standup.rtippenhauer.com
SUPER_ADMIN_EMAIL=rtippenhauer@gmail.com
SECRET_KEY=generate-with-python-below
```

Generate a `SECRET_KEY`:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### Step 6 — Deploy and Verify

```bash
docker compose up -d --build
```

1. Open `https://standup.rtippenhauer.com` — you should see the team selector
2. Navigate to `/admin` — it will prompt you to sign in with Google
3. Sign in with `rtippenhauer@gmail.com`
4. You're in the Super Admin panel

---

## Architecture

### URL Structure

| URL | Access |
|-----|--------|
| `/` | Public — team selector |
| `/team/{slug}` | Public — run stand-up (no login required) |
| `/team/{slug}` + signed in as manager | Full manage access |
| `/admin` | Super admin only |
| `/invite/{token}` | Invite acceptance flow |

### Teams

Default teams: `ndt`, `qmanage`, `release`, `mobile`

Each team has isolated data at `/data/teams/{slug}/`. The super admin can create more teams from `/admin`.

### Adding Managers

1. Go to `/admin`
2. Find the team → click **+ Invite Manager**
3. An invite URL is generated and copied to clipboard (valid 48 hours)
4. Send the URL via Teams/Slack/email
5. Recipient clicks link → signs in with Google → auto-authorized for that team

### Data Migration

Existing data in `/data/settings.json`, `timeoff.json`, etc. is automatically migrated to `/data/teams/ndt/` on first startup. Original files are renamed to `.migrated` for safety.

---

## Data Structure

```
/data/
  teams/
    _global/
      teams.json        # team registry
      invites.json      # invite tokens
    ndt/
      settings.json     # pods, people, timers, theme
      timeoff.json
      timeoff_entries.json
      facts_cache.json
      standup_log.json
    qmanage/
      settings.json
      ...
    release/  ...
    mobile/   ...
```

---

## Deployment on Unraid

1. In Community Applications, install via the template or add manually
2. Required template fields:
   - **Google Client ID** — from Google Cloud Console
   - **Google Client Secret** — from Google Cloud Console
   - **Base URL** — your external URL (e.g. `https://standup.rtippenhauer.com`)
   - **Super Admin Email** — your Gmail address
3. Recommended: set **Session Secret Key** to a fixed random value so sessions survive container restarts
4. Map `/data` to `/mnt/user/appdata/standup`
5. **Port**: default 8080, map to 8081 if 8080 is taken

---

## Development

```bash
# Backend only (hot swap)
docker cp backend/main.py standup-order-generator:/app/backend/main.py
docker restart standup-order-generator

# Frontend changes (always requires full rebuild)
docker compose down
docker rmi standup-standup
docker compose up -d --build --no-cache
```

### Local Development Without Google OAuth

For local dev, you can test the viewer flow (no login) immediately. For the management flow, you need valid OAuth credentials with `http://localhost:8080/api/auth/callback` as an authorized redirect URI.

---

## Tech Stack

- **Backend**: FastAPI, Python 3.12, authlib, itsdangerous, httpx
- **Frontend**: React 18, Vite, Tailwind CSS
- **Auth**: Google OAuth 2.0, HTTP-only signed session cookies (8hr)
- **Container**: Docker multi-stage build, PUID/PGID support
- **Hosting**: Unraid (Community Applications template included)

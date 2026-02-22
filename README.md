# Reso

Music that gets you.

Reso analyzes your Spotify listening history, builds a taste profile, and generates a song tailored to your ears using AI (Suno).

## How It Works

1. **Connect Spotify** -- OAuth login gives Reso read-only access to your top tracks, artists, and listening history
2. **Taste Analysis** -- Your listening data is analyzed to build a musical DNA profile (genres, era, mood, energy)
3. **Prompt Generation** -- Claude (Anthropic) crafts a music generation prompt based on your profile
4. **Song Generation** -- The prompt is sent to Suno, which generates an original song
5. **Listen & Rate** -- Play the song in-app, rate it, and regenerate if you want

## Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS (served via Nginx)
- **Backend:** Python (FastAPI), SSE for real-time progress
- **Song Generation:** [gcui-art/suno-api](https://github.com/gcui-art/suno-api) (Playwright browser automation)
- **AI Prompts:** Anthropic Claude API
- **Auth:** Spotify OAuth 2.0
- **Database:** SQLite via SQLModel
- **Deployment:** Docker Compose (3 services)

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- A [Spotify Developer](https://developer.spotify.com/dashboard) app (for Client ID & Secret)
- An [Anthropic](https://console.anthropic.com/) API key
- A [Suno](https://suno.com) account (for the session cookie)

## Setup

### 1. Clone and configure

```bash
git clone https://github.com/YOUR_USERNAME/reso.git
cd reso
cp .env.example .env
```

Edit `.env` and fill in your credentials (see sections below).

### 2. Get your Spotify credentials

1. Go to https://developer.spotify.com/dashboard
2. Create a new app
3. Set the redirect URI to `http://127.0.0.1:3000/api/auth/callback`
4. Copy the **Client ID** and **Client Secret** into `.env`

### 3. Get your Suno cookie

1. Log in to https://suno.com in Chrome
2. Open DevTools (F12) → Application tab → Cookies → `https://suno.com`
3. Select all cookies, or go to Network tab, find any request, and copy the full `Cookie` header value
4. Paste the entire string as `SUNO_COOKIE` in `.env`

### 4. Get your Anthropic API key

1. Go to https://console.anthropic.com/
2. Create an API key
3. Paste it as `ANTHROPIC_API_KEY` in `.env`

### 5. Generate a secret key

Run this in a terminal and paste the output as `SECRET_KEY` in `.env`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 6. Run

```bash
docker-compose up --build
```

Open http://127.0.0.1:3000 in your browser.

## Usage

1. Click **Connect Spotify** and authorize the app
2. View your musical taste profile (genres, era, mood)
3. Click **Generate** to create your song
4. If a CAPTCHA appears, solve it directly in the Reso UI (click the correct areas, then submit)
5. Once generated, listen to your track, rate it, and find it on Suno via the link

## CAPTCHA Note

Suno uses hCaptcha to prevent automation. When a CAPTCHA is triggered during song generation, Reso takes a screenshot of the challenge and displays it in your browser. You solve it by clicking on the correct areas and submitting. This may happen multiple times per generation. This is expected behavior for the prototype.

## Project Structure

```
reso/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── main.py              # FastAPI app
│   ├── routers/
│   │   ├── auth.py          # Spotify OAuth
│   │   ├── profile.py       # Taste analysis
│   │   ├── generate.py      # Song generation (SSE)
│   │   ├── captcha.py       # CAPTCHA solve proxy
│   │   └── feedback.py      # Rating
│   ├── services/
│   │   ├── spotify.py       # Spotify API client
│   │   ├── analyzer.py      # Taste profile builder
│   │   ├── prompt_builder.py # Claude prompt generation
│   │   └── suno.py          # Suno API client
│   └── db.py                # SQLite models
├── frontend/
│   ├── nginx.conf           # Reverse proxy config
│   └── src/
│       ├── pages/           # Connect, Profile, Generate, Result
│       ├── components/      # AudioPlayer, CaptchaSolver, etc.
│       └── api/client.ts    # API client
└── suno-api/                # gcui-art/suno-api (cloned)
```

## Rebuilding

After code changes:

```powershell
docker-compose down; docker-compose up --build
```

## Built by YA

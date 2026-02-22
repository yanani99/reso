# Reso — Coding Agent Build Spec
**Version:** Prototype 1.0  
**Stack:** Python (FastAPI) + React + Docker  
**Goal:** Full working pipeline — Spotify listening history → taste analysis → Suno prompt → generated song

---

## ⚠️ Critical API Context (Read First)

### Spotify Audio Features: DEPRECATED
Spotify deprecated `/audio-features`, `/audio-analysis`, and `/recommendations` on **November 27, 2024** for all new apps. Do NOT attempt to call these endpoints — they return 403. Instead, the taste analysis layer will use:
- Track metadata (name, artist, album, release year, popularity, duration)
- Artist genre tags (still available via `/v1/artists`)
- Top tracks and top artists (still available)
- Recently played tracks (still available)
- Saved tracks / liked songs (still available)
- An LLM call (Claude API) to infer musical characteristics from this metadata

### Suno: No Official API
Suno has no public official API as of February 2026. Use the open-source wrapper **`gcui-art/suno-api`** (GitHub: https://github.com/gcui-art/suno-api), which wraps Suno's web interface via cookie-based auth. It is self-hosted via Docker. The user must provide their Suno session cookie as an environment variable.

---

## Project Structure

```
reso/
├── docker-compose.yml          # Orchestrates backend + suno-api
├── .env.example                # All required env vars
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                 # FastAPI app entrypoint
│   ├── routers/
│   │   ├── auth.py             # Spotify OAuth flow
│   │   ├── profile.py          # Taste analysis endpoint
│   │   ├── generate.py         # Prompt generation + Suno call
│   │   └── feedback.py         # Rating persistence
│   ├── services/
│   │   ├── spotify.py          # Spotify API client
│   │   ├── analyzer.py         # Taste analysis logic
│   │   ├── prompt_builder.py   # LLM prompt generation
│   │   └── suno.py             # Suno API client
│   └── db.py                   # SQLite via SQLModel
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── pages/
│       │   ├── Connect.tsx     # Spotify OAuth entry
│       │   ├── Profile.tsx     # Show musical DNA
│       │   ├── Generate.tsx    # Platform toggle + generate
│       │   └── Result.tsx      # Player + rating
│       ├── components/
│       │   ├── MoodMap.tsx     # Valence/energy quadrant viz
│       │   ├── GenreCloud.tsx  # Tag cloud of genres
│       │   ├── PromptEditor.tsx # Editable prompt text
│       │   └── AudioPlayer.tsx # Plays the generated song
│       └── api/
│           └── client.ts       # Typed API calls to backend
```

---

## Environment Variables

Create a `.env` file from `.env.example`:

```bash
# Spotify
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/callback

# Anthropic (for prompt generation via Claude)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Suno (via gcui-art/suno-api)
SUNO_COOKIE=your_suno_session_cookie   # See "Getting Suno Cookie" below

# App
SECRET_KEY=random_secret_for_jwt_signing
DATABASE_URL=sqlite:///./reso.db
SUNO_API_URL=http://suno-api:3000       # Internal Docker service name
```

### Getting Your Suno Cookie
1. Go to suno.com/create in Chrome
2. Open DevTools → Network tab → Refresh
3. Find any request with `?__clerk_api_version` in the URL
4. Click it → Headers → copy the full `Cookie` value
5. Paste as `SUNO_COOKIE` in your `.env`

---

## docker-compose.yml

```yaml
version: '3.8'
services:
  suno-api:
    image: gcui-art/suno-api:latest
    container_name: reso-suno-api
    environment:
      - SUNO_COOKIE=${SUNO_COOKIE}
    ports:
      - "3001:3000"
    restart: unless-stopped

  backend:
    build: ./backend
    container_name: reso-backend
    environment:
      - SPOTIFY_CLIENT_ID=${SPOTIFY_CLIENT_ID}
      - SPOTIFY_CLIENT_SECRET=${SPOTIFY_CLIENT_SECRET}
      - SPOTIFY_REDIRECT_URI=${SPOTIFY_REDIRECT_URI}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - SUNO_API_URL=http://suno-api:3000
      - SECRET_KEY=${SECRET_KEY}
      - DATABASE_URL=${DATABASE_URL}
    ports:
      - "8000:8000"
    depends_on:
      - suno-api
    restart: unless-stopped

  frontend:
    build: ./frontend
    container_name: reso-frontend
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:8000
    depends_on:
      - backend
```

---

## Backend Implementation

### `backend/requirements.txt`
```
fastapi
uvicorn[standard]
httpx
anthropic
sqlmodel
python-jose[cryptography]
python-dotenv
pydantic
```

---

### `services/spotify.py`

Spotify OAuth uses the **Authorization Code Flow**.

```python
SCOPES = [
    "user-read-recently-played",
    "user-top-read",
    "user-library-read",
    "user-read-private"
]
```

**Data fetching functions to implement:**

| Function | Spotify Endpoint | Notes |
|---|---|---|
| `get_top_tracks(term)` | `GET /v1/me/top/tracks` | term = short_term / medium_term / long_term |
| `get_top_artists(term)` | `GET /v1/me/top/artists` | Returns genre tags per artist |
| `get_recently_played(limit=50)` | `GET /v1/me/player/recently-played` | |
| `get_saved_tracks(limit=50)` | `GET /v1/me/tracks` | Liked songs — strong signal |
| `get_artist_details(ids)` | `GET /v1/artists?ids=...` | Batch up to 50 for genre tags |

For each track, collect: `name`, `artists`, `album.name`, `album.release_date`, `popularity`, `duration_ms`, `explicit`

For each artist, collect: `genres` (array of strings), `popularity`, `followers.total`

---

### `services/analyzer.py`

Build a structured `TasteProfile` object from raw Spotify data:

```python
class TasteProfile(BaseModel):
    # Genre signals
    top_genres: list[str]           # Top 8 genre tags by weighted frequency
    genre_clusters: list[str]       # Broader clusters e.g. "indie rock", "electronic"
    
    # Era
    era_range: str                  # e.g. "2010s-2020s" from release years
    era_center: int                 # Weighted median release year
    
    # Track signal metadata (for LLM to interpret)
    sample_top_tracks: list[str]    # Top 10 track names + artists as strings
    sample_top_artists: list[str]   # Top 10 artist names
    
    # Engagement signals
    popularity_avg: float           # 0-100; low = underground taste
    explicit_ratio: float           # % of explicit tracks
    
    # Confidence
    track_count: int                # Total tracks analyzed
    confidence: str                 # "high" / "medium" / "low"
```

**Weighting scheme:**

| Source | Weight |
|---|---|
| Liked/saved tracks | 3x |
| Short-term top tracks (last 4 weeks) | 2.5x |
| Recently played | 2x |
| Medium-term top tracks | 1.5x |
| Long-term top tracks | 1x |

Genre frequency: tally artist genre tags across all weighted tracks. Top 8 genres by weighted count = `top_genres`. Cluster by stripping subgenre prefixes to get broader families.

---

### `services/prompt_builder.py`

Make a **single Claude API call** (`claude-sonnet-4-6`) with the full `TasteProfile` and get back two prompts: one for Suno, one for Lyria.

**System prompt to Claude:**
```
You are a music prompt engineer specializing in AI music generation. 
You will receive a structured taste profile derived from a user's Spotify listening history.
Your job is to generate two music generation prompts that describe a song this user would love.

Rules:
- DO NOT reference the user's actual tracks or artists by name in the prompts
- Write prompts that describe the SOUND, not the source material
- Suno prompt: comma-separated style tags + mood words + instrumentation + tempo feel + vocal direction. Max 120 words.
- Lyria prompt: descriptive prose focused on sonic texture, arrangement, production techniques, and instrumentation. Max 120 words.
- Both prompts should describe the SAME song concept, just formatted differently

Return ONLY valid JSON in this format:
{
  "suno_prompt": "...",
  "lyria_prompt": "...",
  "song_concept": "One sentence describing the song concept in plain English",
  "mood": "one word",
  "tempo_feel": "one of: slow / midtempo / uptempo / driving",
  "energy_estimate": 0.0 to 1.0,
  "valence_estimate": 0.0 to 1.0
}
```

**User message to Claude:** Pass the full `TasteProfile` as JSON with a brief framing line.

---

### `services/suno.py`

Use the `gcui-art/suno-api` endpoints:

**Generate (custom mode):**
```
POST {SUNO_API_URL}/api/custom_generate
Body: {
    "prompt": suno_prompt,
    "title": "My Reso Track",
    "tags": top_genres_joined,   // e.g. "indie pop, dream pop, synth"
    "make_instrumental": false,
    "model": "chirp-v4"
}
Returns: [{ "id": "...", "status": "pending" }]
```

**Poll for completion:**
```
GET {SUNO_API_URL}/api/get?ids={id}
Returns: [{ "id": "...", "status": "complete", "audio_url": "...", "image_url": "..." }]
```

**Polling logic:** Poll every 5 seconds, timeout after 3 minutes. Return 503 if timeout. Stream status updates to the frontend via **Server-Sent Events (SSE)** so the UI can show live progress.

---

### API Routes

#### `POST /auth/login`
Returns Spotify OAuth URL. Frontend redirects user here.

#### `GET /auth/callback?code=...`
Exchanges code for tokens. Stores in DB. Returns JWT session token to frontend. **This route must be public — no JWT middleware.**

#### `GET /profile/analyze`
Auth required. Fetches all Spotify data, builds `TasteProfile`, calls Claude for estimates, returns full profile. Cache result for 1 hour per user.

#### `POST /generate`
Auth required.

Request body:
```json
{
  "platform": "suno",
  "custom_prompt_override": "optional user edits",
  "novelty_level": 0.2
}
```

Response (SSE stream):
```
event: status
data: {"stage": "building_prompt", "message": "Crafting your sound profile..."}

event: prompt_ready
data: {"suno_prompt": "...", "lyria_prompt": "...", "song_concept": "..."}

event: status
data: {"stage": "generating", "message": "Generating your track..."}

event: complete
data: {"audio_url": "...", "image_url": "...", "track_id": "abc123"}

event: error
data: {"message": "Suno session expired. Please update SUNO_COOKIE in .env."}
```

#### `POST /feedback`
```json
{ "track_id": "abc123", "rating": 4 }
```

---

## Database Schema (SQLite via SQLModel)

```python
class User(SQLModel, table=True):
    id: str                    # Spotify user ID
    display_name: str
    access_token: str
    refresh_token: str
    token_expiry: datetime
    profile_cache: str | None  # JSON blob of TasteProfile, refreshed hourly
    created_at: datetime

class GeneratedTrack(SQLModel, table=True):
    id: str                    # UUID
    user_id: str               # FK to User
    suno_track_id: str
    audio_url: str
    image_url: str | None
    suno_prompt: str
    lyria_prompt: str
    song_concept: str
    platform: str              # "suno" or "lyria"
    rating: int | None         # 1-5
    created_at: datetime
```

---

## Frontend Implementation

**Stack:** React 18 + TypeScript + Vite + Tailwind CSS

### Design Language
- Background: `#0a0a0f` (dark, feels like a listening room at night)
- Primary accent: electric violet `#8b5cf6`
- Secondary accent: soft coral `#f97316`
- Typography: `Inter` for UI, `Playfair Display` for the Reso logo/headings
- Subtle animated waveform on Generate page while loading
- Sparse use of gradients — only as highlights, not everywhere

### Page Flow

#### `Connect.tsx`
- Full-screen centered layout
- Large **Reso** wordmark
- Tagline: *"Music that gets you."*
- Single CTA: "Connect Spotify"
- Fine print: "We analyze your listening history to generate a song built for your ears. We don't store your Spotify data beyond this session."

#### `Profile.tsx`
After OAuth callback, auto-trigger `/profile/analyze`. Show:

1. **Loading state** — animated waveform, "Reading your musical DNA..."
2. **Profile card:**
   - `GenreCloud` — bubble tag cloud of `top_genres`, sized by weight
   - `MoodMap` — 2x2 quadrant (X=calm↔energetic, Y=dark↔bright). Place a glowing dot using `energy_estimate` and `valence_estimate` from Claude's response. Label quadrants: Euphoric / Intense / Melancholic / Calm.
   - Era chip: "Your sweet spot: **2012–2022**"
   - Taste chip: "You lean **underground**" or "**mainstream**" (popularity_avg < 50 = underground)
3. CTA: "Generate My Song →"

#### `Generate.tsx`
- Platform toggle: **Suno** | **Lyria** (Lyria shows "Coming soon" badge — disabled for prototype)
- Collapsible "Edit prompt" section showing the generated text with inline editing via `PromptEditor.tsx`
- Song concept shown in plain English below the prompt
- Large **"Generate"** button
- SSE-driven progress bar with animated stages and status message text

#### `Result.tsx`
- Suno-generated image as full-bleed album art (with backdrop blur behind)
- Song title and concept text
- `AudioPlayer.tsx` — custom minimal player: play/pause button, scrubber, timestamp
- 5-star rating widget (required before "Regenerate" is shown, or allow skip)
- Two action buttons: **"Regenerate"** | **"Copy Prompt"**

---

## What to Build vs. Stub

| Feature | Build | Stub/Skip |
|---|---|---|
| Spotify OAuth full flow | ✅ | |
| Fetch top tracks, artists, recent, saved | ✅ | |
| TasteProfile builder with weighting | ✅ | |
| Claude prompt generation call | ✅ | |
| Suno generation + polling (gcui-art/suno-api) | ✅ | |
| SSE progress streaming | ✅ | |
| All 4 frontend pages | ✅ | |
| GenreCloud + MoodMap visualizations | ✅ | |
| Custom audio player | ✅ | |
| Rating persistence to DB | ✅ | |
| Lyria integration | | Stub UI only |
| Novelty level affecting prompt | | Hardcode 0.2, show UI slider |
| Ratings influencing future profiles | | Save to DB, don't use yet |

---

## Key Implementation Warnings

1. **Spotify token refresh:** Access tokens expire in 1 hour. Before every Spotify API call, check `token_expiry` and refresh using the refresh token if needed.

2. **Batch artist lookups:** The `/v1/artists?ids=` endpoint accepts up to 50 IDs per call. Collect all unique artist IDs first, then batch into groups of 50. Never make individual per-artist calls.

3. **Suno polling:** Always poll `/api/get` after submitting — never assume the track is ready from the generate response. Use 5-second intervals, switch to 10-second intervals after 1 minute, timeout at 3 minutes.

4. **Suno cookie expiry:** When Suno returns a 401 or generation silently fails, emit an `error` SSE event with: *"Your Suno session has expired. Please update SUNO_COOKIE in .env and restart Docker."*

5. **Strip artist names from Claude input:** Before passing the profile to Claude, confirm the `sample_top_tracks` and `sample_top_artists` fields are sent as-is (the system prompt instructs Claude not to use them directly in output), but do NOT strip them — they are needed for Claude to understand the musical style. The system prompt handles the output restriction.

6. **CORS config:** FastAPI should only allow `http://localhost:3000`. Do not use wildcard `*` in production.

7. **JWT storage:** Store the JWT in an httpOnly cookie from the backend — not in localStorage on the frontend.

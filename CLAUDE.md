# Project context for Claude Code

## What this is
A weather app that started as pure frontend (HTML/CSS/JS) and was extended
with an Express backend + Redis caching layer, containerized with Docker.

## Stack
- Frontend: vanilla HTML/CSS/JS in `public/` (no framework, no build step)
- Backend: Node.js + Express (`server.js`), CommonJS
- Cache: Redis, accessed via the `redis` npm package (v4 client API —
  note this uses `await client.connect()`, `client.get`, `client.setEx`,
  not the older callback-based v3 API)
- Weather data: Open-Meteo (no API key required) — geocoding endpoint then
  forecast endpoint
- Containerization: Dockerfile for the app, docker-compose.yml wiring
  `app` + `redis` services together on the same network

## Key files
- `server.js` — all backend logic lives here for now (single file, MVP-scale)
- `public/index.html`, `public/style.css`, `public/script.js` — frontend
- `Dockerfile` — builds the app image
- `docker-compose.yml` — orchestrates app + redis containers
- `.env.example` — local dev env vars (copy to `.env`, not committed)

## Conventions to follow when extending this project
- Keep secrets out of code — use environment variables, document new ones
  in `.env.example`
- Any new backend route that calls an external API should follow the same
  cache-check → fetch-on-miss → cache-write pattern used in
  `GET /api/weather`
- Redis failures should never take down the app — wrap Redis calls in
  try/catch and fall back to live data (see `server.js` for the pattern)
- If `server.js` grows past ~150-200 lines, split into `routes/`,
  `lib/redisClient.js`, `lib/weatherApi.js` rather than one big file
- Match existing code comment style: explain *why*, not just *what*

## Known MVP limitations (fair game to improve)
- No rate limiting on `/api/weather`
- No automated tests yet
- No input validation beyond "city is non-empty"
- Cache TTL (600s) is hardcoded, not configurable via env var
- No frontend build tooling (intentional, keeps it simple) — if this
  changes, update this file

## Commands
- `npm start` — run backend locally (needs Redis running separately)
- `docker compose up --build` — run everything (app + redis) in containers
- `docker compose down -v` — stop and wipe Redis cache volume

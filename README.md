# Weather App

A weather app with a vanilla HTML/CSS/JS frontend, an Express backend, and a
Redis caching layer in front of the Open-Meteo API. Containerized with Docker.

## Run it

With Docker (app + Redis together):

```bash
docker compose up --build
```

Locally, against your own Redis:

```bash
cp .env.example .env
npm install
npm start
```

Then open http://localhost:3000.

The app works without Redis — if the cache is unreachable, every request
just goes straight to Open-Meteo.

## API

| Route | Description |
| --- | --- |
| `GET /api/weather?city=<name>` | Current conditions + a 5-day forecast. `cached: true` in the response means it came from Redis. |
| `GET /api/health` | App status and whether Redis is connected. |

Responses are cached for 10 minutes, keyed on the lowercased city name.

## Layout

```
server.js            all backend logic (routes, cache, Open-Meteo calls)
public/              frontend — index.html, style.css, script.js
Dockerfile           app image
docker-compose.yml   app + redis
.env.example         env vars; copy to .env for local dev
```

## Commands

- `npm start` — run the backend locally (needs Redis running separately)
- `docker compose up --build` — run everything in containers
- `docker compose down -v` — stop and wipe the Redis cache volume

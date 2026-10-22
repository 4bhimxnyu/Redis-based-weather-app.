# 🌤️ Redis Based Weather App

A responsive weather forecasting web application built with a **vanilla HTML/CSS/JavaScript frontend**, an **Express.js backend**, and **Redis caching**.

The application fetches weather data from the **Open-Meteo API** and uses Redis to cache responses for faster repeated requests and reduce unnecessary API calls.

The entire application can be run locally or containerized using **Docker and Docker Compose**.

## ✨ Features

* 🌍 Search weather by city
* 🌡️ Current weather conditions
* 📅 5-day weather forecast
* ⚡ Redis-based API response caching
* 🕐 10-minute cache expiration
* 🔄 Graceful fallback when Redis is unavailable
* 🩺 Health-check endpoint
* 🐳 Dockerized application
* 🔗 Docker Compose setup for the app and Redis
* 📱 Responsive frontend

## 🛠️ Tech Stack

### Frontend

* HTML5
* CSS3
* Vanilla JavaScript

### Backend

* Node.js
* Express.js

### API

* Open-Meteo API

### Caching

* Redis 7
* Redis TTL-based caching

### DevOps

* Docker
* Docker Compose

## 🏗️ Architecture

```text
                         ┌─────────────────┐
                         │     Browser     │
                         │  HTML/CSS/JS    │
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │   Express.js    │
                         │     Backend     │
                         └────────┬────────┘
                                  │
                         Check Redis Cache
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                CACHE HIT                  CACHE MISS
                    │                           │
                    ▼                           ▼
             Return cached data          Open-Meteo API
                                                │
                                                ▼
                                         Store in Redis
                                                │
                                                ▼
                                         Return response
```

## 🔴 Redis Caching

Redis is used as a caching layer between the Express backend and the Open-Meteo API.

When a user requests weather information, the backend first checks Redis.

### Cache Hit

If the requested city exists in Redis:

```text
Client → Express → Redis → Cached Weather → Client
```

The external weather API does not need to be called.

### Cache Miss

If the city isn't cached:

```text
Client → Express → Redis
                   ↓
               Cache Miss
                   ↓
             Open-Meteo API
                   ↓
             Store in Redis
                   ↓
                Client
```

Weather responses are cached for **10 minutes** and are keyed using the lowercased city name.

Example:

```text
weather:pune
weather:mumbai
weather:delhi
```

The API response includes:

```json
{
  "cached": true
}
```

when the response was served from Redis.

## 🧯 Redis Fallback

Redis is **not required for the application to function**.

If Redis becomes unavailable, the backend automatically bypasses the cache and requests the weather data directly from Open-Meteo.

```text
Redis available
      ↓
Check cache
      ↓
Use cached data / fetch + cache


Redis unavailable
      ↓
Skip cache
      ↓
Fetch directly from Open-Meteo
```

This allows the weather application to continue working even if the caching layer is unavailable.

## 🚀 Getting Started

### Prerequisites

For local development:

* Node.js
* npm
* Redis

For the Docker setup:

* Docker
* Docker Compose

### Run with Docker

The easiest way to run the complete application is Docker Compose.

```bash
docker compose up --build
```

This starts:

* Express application
* Redis 7
* Docker network
* Persistent Redis volume

The application will be available at:

```text
http://localhost:3000
```

### Run Locally

Copy the example environment file:

```bash
cp .env.example .env
```

Install dependencies:

```bash
npm install
```

Start the application:

```bash
npm start
```

Make sure Redis is running separately when running the backend outside Docker.

Then open:

```text
http://localhost:3000
```

## 🔐 Environment Variables

Create a `.env` file using `.env.example` as a reference.

```env
REDIS_URL=redis://localhost:6379
```

When running through Docker Compose, the application connects to the Redis service using:

```env
REDIS_URL=redis://redis:6379
```

Environment files containing sensitive configuration should not be committed to the repository.

## 🔌 API

### Get Weather

```http
GET /api/weather?city=<name>
```

Returns the current weather conditions and a **5-day forecast** for the requested city.

Example:

```text
GET /api/weather?city=Pune
```

The response contains a `cached` field indicating whether the data was retrieved from Redis.

```json
{
  "cached": true
}
```

### Health Check

```http
GET /api/health
```

Returns the application's current status and Redis connection status.

This endpoint can be used to verify that the backend and caching layer are operating correctly.

## 📁 Project Structure

```text
Weather-Forecast-App/
│
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
│
├── server.js
├── package.json
├── package-lock.json
│
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
│
├── .env.example
├── .gitignore
│
└── README.md
```

### Key Files

| File                 | Purpose                                                           |
| -------------------- | ----------------------------------------------------------------- |
| `server.js`          | Express server, API routes, Redis caching and Open-Meteo requests |
| `public/index.html`  | Weather app interface                                             |
| `public/style.css`   | Application styling                                               |
| `public/script.js`   | Frontend functionality and API requests                           |
| `Dockerfile`         | Builds the Node.js application image                              |
| `docker-compose.yml` | Runs the application and Redis together                           |
| `.env.example`       | Example environment configuration                                 |

## 🐳 Docker

The project uses Docker to create a consistent development and deployment environment.

The application runs in a Node.js container while Redis runs as a separate service.

```text
┌──────────────────────────────┐
│        Docker Compose        │
│                              │
│  ┌────────────┐ ┌─────────┐ │
│  │ Node/Express│ │ Redis 7 │ │
│  │    App      │ │         │ │
│  └────────────┘ └─────────┘ │
│         │            ▲       │
│         └────────────┘       │
│                              │
└──────────────────────────────┘
```

### Check containers

```bash
docker compose ps
```

### Test Redis

```bash
docker compose exec redis redis-cli ping
```

Expected:

```text
PONG
```

### View application logs

```bash
docker compose logs app
```

### Stop the application

```bash
docker compose down
```

### Stop and remove the Redis volume

```bash
docker compose down -v
```

> `docker compose down -v` removes the Redis data stored in the Docker volume and therefore clears the cache.

## ⚡ Performance

Redis caching helps avoid repeatedly requesting the same weather information from Open-Meteo.

For example, if 100 users request the weather for Pune within the cache period:

```text
Without Redis

100 requests
     ↓
100 Open-Meteo API requests


With Redis

100 requests
     ↓
1 Open-Meteo API request
     ↓
99 cached responses
```

The exact number of external requests depends on the cache expiration and the cities being requested.

## ☁️ Deployment

The application can be deployed using a separate frontend/backend architecture or as a containerized application.

A production setup can look like:

```text
                 Internet
                    │
                    ▼
                Frontend
                    │
                    ▼
              Node.js API
                    │
                    ▼
               Cloud Redis
                    │
                    ▼
              Open-Meteo API
```

For production, Redis should be provided by a managed cloud Redis service rather than relying on a local Docker container.

Environment variables should also be configured through the hosting provider instead of being committed to the repository.

## 📈 Future Improvements

* [ ] Weather-based background changes
* [ ] Automatic location detection
* [ ] Extended forecast
* [ ] Search history
* [ ] Redis cache statistics
* [ ] Improved loading states
* [ ] Better error handling
* [ ] API rate-limit handling
* [ ] Automated CI/CD
* [ ] Production monitoring
* [ ] Unit and integration tests

## 👨‍💻 Project

A weather application developed to explore **API integration, backend development, Redis caching, Docker, and containerized application architecture**.

---

⭐ If you found this project useful, consider giving the repository a star.

## 🚀 CI/CD Pipeline & Multi-Stage Build

Every push to `main` runs `.github/workflows/ci-cd.yml`:

1. **build-and-test** – builds the `test` stage of the Dockerfile and runs the test suite inside the container.
2. **push-image** – only if tests pass (and only on `main`): pushes `<DOCKER_USERNAME>/redis-weather-app:latest` and `:<commit-sha>` to Docker Hub.
3. **deploy** – pulls the pushed image, runs it next to Redis, and smoke-tests `/api/health`.

Add two repository secrets first (Settings → Secrets and variables → Actions): `DOCKER_USERNAME` and `DOCKER_TOKEN` (a Docker Hub personal access token with Read & Write).

The Dockerfile is multi-stage: `deps` (production deps via `npm ci`), `test` (runs tests, never shipped) and `runtime` (clean `node:22-alpine` with only `node_modules`, `server.js`, `public/`). The runtime image is **62.2 MB**, compared with **411 MB** for the same app on the full `node:22` base.

```bash
npm test                                                     # run tests locally
docker build --target test -t weather:test . && docker run --rm weather:test
```

// Loads .env in local development; a no-op in Docker, where compose supplies
// the same variables directly.
require('dotenv').config();

const path = require('path');
const express = require('express');
const { createClient } = require('redis');

const app = express();
const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Open-Meteo needs two hops: name -> coordinates, then coordinates -> forecast.
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

// Ten minutes: long enough that repeated searches for the same city are cheap,
// short enough that "current" conditions still deserve the name.
const CACHE_TTL_SECONDS = 600;

app.use(express.static(path.join(__dirname, 'public')));

// A single shared client, connected once at startup. `isReady` is what the
// route handlers check - if the connection drops, redis v4 flips it back to
// false on its own and we quietly serve live data instead.
const redis = createClient({
  url: REDIS_URL,
  socket: {
    // Backs off instead of hammering a dead Redis every few milliseconds,
    // while still recovering on its own once the cache comes back.
    reconnectStrategy: (retries) => Math.min(retries * 500, 10000),
  },
});

// Connection refusals arrive as AggregateErrors with an empty message, so
// fall back to the code before logging something unreadable.
const reason = (err) => err.message || err.code || String(err);

let lastRedisError = null;
redis.on('error', (err) => {
  // Logged, not thrown: an unhandled 'error' event would kill the process,
  // and losing the cache should never take the app down. Repeats of the same
  // error are dropped so a long outage does not flood the logs.
  const message = reason(err);
  if (message === lastRedisError) return;
  lastRedisError = message;
  console.error('[redis]', message);
});
redis.on('ready', () => {
  lastRedisError = null;
});

async function cacheGet(key) {
  if (!redis.isReady) return null;
  try {
    const hit = await redis.get(key);
    return hit ? JSON.parse(hit) : null;
  } catch (err) {
    console.error('[redis] read failed:', reason(err));
    return null; // treated as a miss
  }
}

async function cacheSet(key, value) {
  if (!redis.isReady) return;
  try {
    await redis.setEx(key, CACHE_TTL_SECONDS, JSON.stringify(value));
  } catch (err) {
    // The response is already good; a failed write only costs us the next hit.
    console.error('[redis] write failed:', reason(err));
  }
}

async function geocode(city) {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`geocoding failed (${res.status})`);
  const body = await res.json();
  return body.results && body.results[0] ? body.results[0] : null;
}

async function forecast(latitude, longitude) {
  const params = new URLSearchParams({
    latitude,
    longitude,
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min,weather_code',
    timezone: 'auto',
    forecast_days: '5',
  });
  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error(`forecast failed (${res.status})`);
  return res.json();
}

app.get('/api/weather', async (req, res) => {
  const city = (req.query.city || '').trim();
  if (!city) {
    return res.status(400).json({ error: 'A city name is required.' });
  }

  // Lowercased so "Paris" and "paris" share one entry.
  const key = `weather:${city.toLowerCase()}`;

  const cached = await cacheGet(key);
  if (cached) {
    return res.json({ ...cached, cached: true });
  }

  try {
    const place = await geocode(city);
    if (!place) {
      // Not cached: a typo today may be a real place once the user fixes it.
      return res.status(404).json({ error: `No results for "${city}".` });
    }

    const data = await forecast(place.latitude, place.longitude);
    const payload = {
      location: {
        name: place.name,
        country: place.country,
        admin1: place.admin1 || null,
        latitude: place.latitude,
        longitude: place.longitude,
        timezone: data.timezone,
      },
      current: data.current,
      daily: data.daily,
      fetchedAt: new Date().toISOString(),
    };

    await cacheSet(key, payload);
    res.json({ ...payload, cached: false });
  } catch (err) {
    console.error('[weather]', err.message);
    res.status(502).json({ error: 'Could not reach the weather service.' });
  }
});

// Reports cache state separately from app state, so a container healthcheck
// stays green while Redis is down - which is the intended behaviour.
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', redis: redis.isReady ? 'connected' : 'unavailable' });
});

// The HTTP server comes up first and the cache connects behind it. Awaiting
// connect() here would hang forever when Redis is down, because the reconnect
// strategy above retries instead of rejecting - and an unreachable cache must
// never stop the app from serving live data.
app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));

redis
  .connect()
  .then(() => console.log(`Connected to Redis at ${REDIS_URL}`))
  .catch((err) => console.error(`Redis unavailable (${reason(err)}) - serving live data only.`));

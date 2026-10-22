// Uses Node's built-in test runner, so the test stage of the Dockerfile needs
// no extra dev dependencies. Open-Meteo is mocked: CI must not depend on a
// third-party API being up, and Redis is left disconnected on purpose to
// exercise the live-data fallback.
const { test, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('../server');

const realFetch = globalThis.fetch;
let server;
let base;

const PUNE = { name: 'Pune', country: 'India', admin1: 'Maharashtra', latitude: 18.52, longitude: 73.86 };
const FORECAST = {
  timezone: 'Asia/Kolkata',
  current: { temperature_2m: 29.4, relative_humidity_2m: 48, wind_speed_10m: 11.2, weather_code: 1 },
  daily: { time: ['2026-03-27'], temperature_2m_max: [34], temperature_2m_min: [20], weather_code: [1] },
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Requests to our own server go through untouched; anything else is upstream.
function mockUpstream(handler) {
  mock.method(globalThis, 'fetch', (url, opts) =>
    String(url).startsWith(base) ? realFetch(url, opts) : handler(String(url)));
}

before(() => new Promise((resolve) => {
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${server.address().port}`;
    resolve();
  });
}));
after(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => mock.restoreAll());

test('health reports ok even when Redis is unavailable', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok', redis: 'unavailable' });
});

test('serves the frontend', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<html/i);
});

test('rejects a missing city with 400', async () => {
  const res = await fetch(`${base}/api/weather?city=%20%20`);
  assert.equal(res.status, 400);
});

test('returns live weather when the cache is down', async () => {
  mockUpstream((url) => (url.includes('geocoding') ? json({ results: [PUNE] }) : json(FORECAST)));

  const res = await fetch(`${base}/api/weather?city=Pune`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.location.name, 'Pune');
  assert.equal(body.current.temperature_2m, 29.4);
  assert.equal(body.cached, false);
});

test('returns 404 for an unknown city', async () => {
  mockUpstream(() => json({}));
  const res = await fetch(`${base}/api/weather?city=Nowhereville`);
  assert.equal(res.status, 404);
});

test('returns 502 when the weather service fails', async () => {
  mockUpstream(() => json({ error: 'boom' }, 500));
  const res = await fetch(`${base}/api/weather?city=Pune`);
  assert.equal(res.status, 502);
});

test('retries once when the network drops on the first attempt', async () => {
  let calls = 0;
  mockUpstream((url) => {
    calls += 1;
    if (calls === 1) return Promise.reject(new TypeError('fetch failed'));
    return url.includes('geocoding') ? json({ results: [PUNE] }) : json(FORECAST);
  });

  const res = await fetch(`${base}/api/weather?city=Pune`);
  assert.equal(res.status, 200);
  assert.equal(calls, 3); // failed geocode, retried geocode, forecast
});

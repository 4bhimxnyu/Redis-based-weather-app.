// WMO weather interpretation codes, grouped rather than listed one-by-one:
// Open-Meteo returns ~28 codes and the differences between neighbours
// (light vs. moderate drizzle) are not worth separate UI copy.
const WEATHER_CODES = {
  0: ['Clear sky', '☀️'],
  1: ['Mainly clear', '🌤️'],
  2: ['Partly cloudy', '⛅'],
  3: ['Overcast', '☁️'],
  45: ['Fog', '🌫️'], 48: ['Rime fog', '🌫️'],
  51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Heavy drizzle', '🌦️'],
  56: ['Freezing drizzle', '🌧️'], 57: ['Freezing drizzle', '🌧️'],
  61: ['Light rain', '🌧️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'],
  66: ['Freezing rain', '🌧️'], 67: ['Freezing rain', '🌧️'],
  71: ['Light snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Heavy snow', '🌨️'],
  77: ['Snow grains', '🌨️'],
  80: ['Light showers', '🌦️'], 81: ['Showers', '🌦️'], 82: ['Violent showers', '⛈️'],
  85: ['Snow showers', '🌨️'], 86: ['Snow showers', '🌨️'],
  95: ['Thunderstorm', '⛈️'],
  96: ['Thunderstorm with hail', '⛈️'], 99: ['Thunderstorm with hail', '⛈️'],
};

const describe = (code) => WEATHER_CODES[code] || ['Unknown', '❓'];

const form = document.getElementById('search');
const cityInput = document.getElementById('city');
const button = form.querySelector('button');
const status = document.getElementById('status');
const result = document.getElementById('result');

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function render(data) {
  const { location, current, daily } = data;
  const [label, icon] = describe(current.weather_code);

  document.getElementById('place-name').textContent = location.name;
  document.getElementById('place-meta').textContent =
    [location.admin1, location.country].filter(Boolean).join(', ');

  document.getElementById('temp').textContent = `${Math.round(current.temperature_2m)}°C`;
  document.getElementById('conditions').textContent = `${icon} ${label}`;
  document.getElementById('humidity').textContent = `${current.relative_humidity_2m}%`;
  document.getElementById('wind').textContent = `${Math.round(current.wind_speed_10m)} km/h`;

  const forecast = document.getElementById('forecast');
  forecast.replaceChildren(...daily.time.map((date, i) => {
    const [, dayIcon] = describe(daily.weather_code[i]);
    const li = document.createElement('li');
    // Parsed as UTC by Date, so format in UTC too — otherwise a user west of
    // Greenwich sees every day label shifted back by one.
    const day = i === 0
      ? 'Today'
      : new Date(date).toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
    li.innerHTML =
      `<div class="day">${day}</div>` +
      `<div class="icon">${dayIcon}</div>` +
      `<div class="range">${Math.round(daily.temperature_2m_max[i])}°` +
      ` <span class="low">${Math.round(daily.temperature_2m_min[i])}°</span></div>`;
    return li;
  }));

  const age = new Date(data.fetchedAt).toLocaleTimeString();
  document.getElementById('cache-note').textContent = data.cached
    ? `Served from cache — measured at ${age}.`
    : `Fetched live at ${age}.`;

  result.hidden = false;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const city = cityInput.value.trim();
  if (!city) return;

  button.disabled = true;
  setStatus('Loading…');

  try {
    const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Something went wrong.');
    render(body);
    setStatus('');
  } catch (err) {
    result.hidden = true;
    setStatus(err.message, true);
  } finally {
    button.disabled = false;
  }
});

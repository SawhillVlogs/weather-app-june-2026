// index.js - Live fetching for Europe Weather App
// Replace the string below with your OpenWeatherMap API key (development only)
const API_KEY = "53f952e307e4fdda92a99ceacb14639e";

// Config - adjust if needed
const maxRequestsPerMinute = 50; // conservative rate
const cacheTTL = 10 * 60 * 1000; // 10 minutes
const autoRefreshMs = 10 * 60 * 1000; // auto-refresh interval
const staggerMs = Math.ceil(60000 / Math.max(1, maxRequestsPerMinute));

// List of major European cities
const citiesList = [
  "London,GB", "Paris,FR", "Berlin,DE", "Madrid,ES", "Rome,IT", "Lisbon,PT", "Amsterdam,NL",
  "Brussels,BE", "Vienna,AT", "Prague,CZ", "Budapest,HU", "Warsaw,PL", "Dublin,IE", "Copenhagen,DK",
  "Stockholm,SE", "Oslo,NO", "Helsinki,FI", "Athens,GR", "Istanbul,TR", "Barcelona,ES", "Munich,DE",
  "Zurich,CH", "Belgrade,RS", "Bucharest,RO", "Sofia,BG", "Zagreb,HR", "Ljubljana,SI", "Riga,LV",
  "Tallinn,EE", "Vilnius,LT"
];

// State & DOM
let currentUnit = "C";
const cityData = {}; // keyed by "City,CC"

const citiesContainer = document.getElementById("cities");
const searchInput = document.getElementById("search");
const unitToggleBtn = document.getElementById("unitToggle");
const refreshBtn = document.getElementById("refreshBtn");

// Utilities
function formatTemp(celsius) {
  if (celsius === null || celsius === undefined) return "--";
  if (currentUnit === "C") return `${Math.round(celsius)}°C`;
  const f = celsius * 9 / 5 + 32;
  return `${Math.round(f)}°F`;
}

function safeGet(obj, path, fallback = undefined) {
  try {
    return path.split('.').reduce((o, p) => o && o[p], obj) ?? fallback;
  } catch {
    return fallback;
  }
}

// DOM update for a single card
function updateCard(key) {
  const card = document.querySelector(`.card[data-key="${key}"]`);
  if (!card) return;
  const data = cityData[key];
  const tempEl = card.querySelector(".temp");
  const descEl = card.querySelector(".desc");
  const metaEl = card.querySelector(".meta");

  let iconEl = card.querySelector(".icon");
  if (!iconEl) {
    iconEl = document.createElement("img");
    iconEl.className = "icon";
    iconEl.alt = "";
    // insert before temp
    const top = card.querySelector(".top");
    top.insertBefore(iconEl, top.querySelector(".temp"));
    // small default style
    iconEl.style.width = "48px";
    iconEl.style.height = "48px";
    iconEl.style.objectFit = "contain";
    iconEl.style.marginLeft = "8px";
  }

  if (!data) {
    tempEl.textContent = "--";
    descEl.textContent = "No data";
    metaEl.textContent = "Wind: -- | Humidity: --";
    iconEl.src = "";
    card.classList.remove("loading");
    return;
  }

  if (data.error) {
    tempEl.textContent = "--";
    descEl.textContent = "Error fetching";
    metaEl.textContent = "";
    iconEl.src = "";
    card.classList.remove("loading");
    return;
  }

  tempEl.textContent = formatTemp(data.temp);
  descEl.textContent = data.desc || "";
  metaEl.textContent = `Wind: ${data.wind ?? "--"} m/s | Humidity: ${data.humidity ?? "--"}%`;
  if (data.icon) {
    iconEl.src = `https://openweathermap.org/img/wn/${data.icon}@2x.png`;
    iconEl.alt = data.desc || "";
  } else {
    iconEl.src = "";
    iconEl.alt = "";
  }

  card.classList.remove("loading");
}

// Fetch a city's weather
async function fetchCityWeather(key, force = false) {
  if (!API_KEY || API_KEY === "YOUR_API_KEY_HERE") {
    console.warn("API key not set. Put your OpenWeatherMap key in index.js.");
    return;
  }

  const cached = cityData[key];
  if (!force && cached && (Date.now() - (cached.timestamp || 0) < cacheTTL)) {
    updateCard(key);
    return cached;
  }

  // loading UI
  const card = document.querySelector(`.card[data-key="${key}"]`);
  if (card) {
    card.classList.add("loading");
    const t = card.querySelector(".temp");
    if (t) t.textContent = "...";
    const d = card.querySelector(".desc");
    if (d) d.textContent = "Loading...";
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(key)}&appid=${API_KEY}&units=metric`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`HTTP ${resp.status} ${text}`);
    }
    const json = await resp.json();

    const data = {
      temp: safeGet(json, "main.temp", null),
      desc: safeGet(json, "weather.0.description", ""),
      wind: safeGet(json, "wind.speed", null),
      humidity: safeGet(json, "main.humidity", null),
      icon: safeGet(json, "weather.0.icon", null),
      timestamp: Date.now(),
      raw: json
    };

    cityData[key] = data;
    updateCard(key);
    return data;
  } catch (err) {
    console.error("Fetch error for", key, err);
    cityData[key] = {
      error: true,
      timestamp: Date.now()
    };
    updateCard(key);
  }
}

// Fetch all cities with staggering
function fetchAllCities(force = false) {
  if (!API_KEY || API_KEY === "YOUR_API_KEY_HERE") {
    console.warn("API key not set; set it at top of index.js.");
    return;
  }
  // status in console
  console.log("Refreshing weather data...");
  citiesList.forEach((key, i) => {
    setTimeout(async () => {
      await fetchCityWeather(key, force);
      if (i === citiesList.length - 1) {
        console.log("All cities requested. Last refresh:", new Date().toLocaleTimeString());
      }
    }, i * staggerMs);
  });
}

// Render cards
function renderCities(filter = "") {
  citiesContainer.innerHTML = "";
  const lowerFilter = filter.trim().toLowerCase();
  const filtered = citiesList.filter(c => c.split(",")[0].toLowerCase().includes(lowerFilter));
  filtered.forEach(key => {
    const cityName = key.split(",")[0];
    const tempC = cityData[key] ? cityData[key].temp : null;
    const description = cityData[key] ? cityData[key].desc : "No data";

    const card = document.createElement("article");
    card.className = "card";
    card.setAttribute("data-key", key);
    card.innerHTML = `
      <div class="top">
        <div class="city">
          <div class="city-name">${cityName}</div>
          <div class="city-cc">${key.split(",")[1]}</div>
        </div>
        <div class="temp">${formatTemp(tempC)}</div>
      </div>
      <div class="details">
        <div class="desc">${description}</div>
        <div class="meta">Wind: -- | Humidity: --</div>
        <div class="hint" style="opacity:0.8;font-size:12px;margin-top:6px;">(Click to expand)</div>
      </div>
    `;

    card.addEventListener("click", () => {
      card.classList.toggle("expanded");
      const data = cityData[key];
      const isStale = !data || (Date.now() - (data.timestamp || 0) > cacheTTL);
      if (isStale) fetchCityWeather(key, true);
    });

    citiesContainer.appendChild(card);

    if (cityData[key]) updateCard(key);
  });

  if (filtered.length === 0) {
    citiesContainer.innerHTML = `<p style="color:rgba(255,255,255,0.9);">No cities match "${filter}"</p>`;
  }
}

// UI controls
unitToggleBtn.addEventListener("click", () => {
  currentUnit = (currentUnit === "C") ? "F" : "C";
  unitToggleBtn.textContent = currentUnit === "C" ? "Show °F" : "Show °C";
  unitToggleBtn.setAttribute("aria-pressed", currentUnit === "F");
  renderCities(searchInput.value);
});
searchInput.addEventListener("input", (e) => renderCities(e.target.value));
refreshBtn.addEventListener("click", () => fetchAllCities(true));

// Start
document.addEventListener("DOMContentLoaded", () => {
  renderCities();
  fetchAllCities(true);
  setInterval(() => fetchAllCities(false), autoRefreshMs);
});
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useEffect, useState } from "react";
import "./App.css";

const API_BASE_URL = "http://127.0.0.1:8000";
const API_URL = `${API_BASE_URL}/latest-reading`;
const WEATHER_API_URL = `${API_BASE_URL}/weather-forecast`;
const RISK_API_URL = `${API_BASE_URL}/flood-risk`;

function App() {
  const [reading, setReading] = useState(null);
  const [connection, setConnection] = useState("Connecting");
  const [lastChecked, setLastChecked] = useState(null);

  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState("");
  const [weatherLoading, setWeatherLoading] = useState(true);

  const [floodRisk, setFloodRisk] = useState(null);
  const [riskError, setRiskError] = useState("");
  const [riskLoading, setRiskLoading] = useState(true);

  // Poll live sensor readings every 2 seconds.
  useEffect(() => {
    let active = true;

    async function fetchReading() {
      try {
        const response = await fetch(API_URL);

        if (!response.ok) {
          throw new Error("Backend request failed");
        }

        const data = await response.json();

        if (!active) return;

        if (data.water_level_cm !== undefined) {
          setReading(data);
        }

        setConnection("Connected");
        setLastChecked(new Date());
      } catch {
        if (active) setConnection("Disconnected");
      }
    }

    fetchReading();
    const interval = setInterval(fetchReading, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Refresh the weather forecast every 10 minutes.
  useEffect(() => {
    let active = true;

    async function fetchWeather() {
      try {
        const response = await fetch(WEATHER_API_URL);

        if (!response.ok) {
          throw new Error("Weather request failed");
        }

        const data = await response.json();

        if (!Array.isArray(data.hourly_forecast)) {
          throw new Error("Invalid weather response");
        }

        if (active) {
          setWeather(data);
          setWeatherError("");
          setWeatherLoading(false);
        }
      } catch {
        if (active) {
          setWeatherError(
            "Weather forecast unavailable. Check your backend and internet connection."
          );
          setWeatherLoading(false);
        }
      }
    }

    fetchWeather();
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Refresh the backend risk assessment every 5 seconds.
  useEffect(() => {
    let active = true;

    async function fetchRisk() {
      try {
        const response = await fetch(RISK_API_URL);

        if (!response.ok) {
          throw new Error("Risk assessment request failed");
        }

        const data = await response.json();

        if (active) {
          setFloodRisk(data);
          setRiskError("");
          setRiskLoading(false);
        }
      } catch {
        if (active) {
          setRiskError("Flood-risk assessment is currently unavailable.");
          setRiskLoading(false);
        }
      }
    }

    fetchRisk();
    const interval = setInterval(fetchRisk, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const rapidRise = reading?.status === "RAPID_RISE";

  const riskLevel = String(
    floodRisk?.risk_level ?? "INSUFFICIENT DATA"
  ).toUpperCase();

  const riskClass = ["LOW", "MODERATE", "HIGH"].includes(riskLevel)
    ? riskLevel.toLowerCase()
    : "unknown";

  const rainfallChartData = (weather?.hourly_forecast ?? []).map((item) => ({
    time: String(item.time).split("T")[1]?.slice(0, 5) ?? item.time,
    rainfall:
      item.precipitation_mm == null ||
      !Number.isFinite(Number(item.precipitation_mm))
        ? null
        : Number(item.precipitation_mm),
  }));

  const validRainfall = (weather?.hourly_forecast ?? [])
    .map((item) => Number(item.precipitation_mm))
    .filter(
      (value) =>
        Number.isFinite(value) && value >= 0
    );

  const maximumRainfall = validRainfall.length
    ? Math.max(...validRainfall)
    : null;

  const totalRainfall = validRainfall.length
    ? validRainfall.reduce((sum, value) => sum + value, 0)
    : null;

  const dataSources = [
    {
      name: "Live water-level sensor",
      detail: "ESP8266 and ultrasonic sensor",
      state: reading ? "Available" : "Waiting",
      ready: Boolean(reading),
    },
    {
      name: "Weather forecast",
      detail: "Hourly precipitation forecast from Open-Meteo",
      state: weather ? "Connected" : "Unavailable",
      ready: Boolean(weather),
    },
    {
      name: "Terrain elevation data",
      detail: "Needed to identify low-lying flood-prone areas",
      state: "Not connected",
      ready: false,
    },
    {
      name: "Drainage network and capacity",
      detail: "Drain connections, flow capacity, and blockage data",
      state: "Not connected",
      ready: false,
    },
    {
      name: "Validated flood prediction model",
      detail: "Requires suitable data, development, and validation",
      state: "Not available",
      ready: false,
    },
  ];

  return (
    <main className="dashboard">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">≈</div>
          <div>
            <h1>FloodWatch</h1>
            <p>Urban Flood Monitoring &amp; Early Warning</p>
          </div>
        </div>

        <div className={`connection ${connection.toLowerCase()}`}>
          <span className="connection-dot" />
          API {connection}
        </div>
      </header>

      <section className="intro">
        <div>
          <p className="eyebrow">SIH 26085 · FLOOD INTELLIGENCE</p>
          <h2>Flood Monitoring &amp; Risk Overview</h2>
          <p className="subtitle">
            Live water-level measurements, rainfall forecasts, and
            threshold-based risk assessment.
          </p>
        </div>

        <div className="location">
          <span>⌖</span>
          <div>
            <strong>Drain 01</strong>
            <small>
              Location ID: {reading?.location_id || "drain_01"}
            </small>
            <small>Weather area: Meerut</small>
          </div>
        </div>
      </section>

      <section className="section-heading">
        <div>
          <h3>Live monitoring</h3>
          <p>Measurements received from the connected sensor setup.</p>
        </div>
        <span className="live-badge">
          <span className="live-dot" />
          LIVE DATA
        </span>
      </section>

      {!reading ? (
        <section className="empty-state">
          <h3>
            {connection === "Disconnected"
              ? "Backend connection unavailable"
              : "Waiting for sensor data"}
          </h3>
          <p>
            {connection === "Disconnected"
              ? "Check that FastAPI is running on port 8000."
              : "Make sure your ESP8266 is sending readings to FastAPI."}
          </p>
        </section>
      ) : (
        <>
          <section className="metrics">
            <article className="metric-card water-card">
              <div className="metric-heading">
                <span>Water level</span>
                <span className="metric-icon">≈</span>
              </div>
              <div className="metric-value">
                {Number(reading.water_level_cm).toFixed(1)}
                <span> cm</span>
              </div>
              <p>Measured depth in the current demo container</p>
            </article>

            <article className="metric-card rate-card">
              <div className="metric-heading">
                <span>Water rise rate</span>
                <span className="metric-icon">↗</span>
              </div>
              <div className="metric-value">
                {Number.isFinite(Number(reading.rise_rate_cm_per_min))
                  ? Number(reading.rise_rate_cm_per_min).toFixed(1)
                  : "N/A"}
                <span> cm/min</span>
              </div>
              <p>Reported rate of change in water level</p>
            </article>

            <article
              className={`metric-card status-card ${rapidRise ? "danger" : ""}`}
            >
              <div className="metric-heading">
                <span>Sensor warning</span>
                <span className="metric-icon">{rapidRise ? "!" : "✓"}</span>
              </div>
              <div className="status-value">
                {reading.status || "UNKNOWN"}
              </div>
              <p>
                {rapidRise
                  ? "Rapid water rise reported by the sensor"
                  : "No rapid-rise alert currently reported"}
              </p>
            </article>
          </section>

          <section className="details">
            <div>
              <span className="detail-label">Sensor location ID</span>
              <strong>{reading.location_id || "drain_01"}</strong>
            </div>
            <div>
              <span className="detail-label">Last received by backend</span>
              <strong>
                {reading.received_at
                  ? new Date(reading.received_at).toLocaleString("en-IN")
                  : "Timestamp unavailable"}
              </strong>
            </div>
            <div>
              <span className="detail-label">Dashboard checked</span>
              <strong>
                {lastChecked
                  ? lastChecked.toLocaleTimeString("en-IN")
                  : "—"}
              </strong>
            </div>
          </section>
        </>
      )}

      {/* Current flood-risk assessment */}
      <section className={`risk-panel risk-${riskClass}`}>
        <div className="risk-panel-header">
          <div>
            <p className="eyebrow">CURRENT RISK ASSESSMENT</p>
            <h3>Flood Risk: {riskLevel.replaceAll("_", " ")}</h3>
          </div>

          <span className="risk-indicator">
            {riskLevel === "HIGH"
              ? "ACTION REQUIRED"
              : riskLevel === "MODERATE"
                ? "MONITOR CLOSELY"
                : riskLevel === "LOW"
                  ? "NORMAL MONITORING"
                  : "CHECK DATA"}
          </span>
        </div>

        {riskError ? (
          <p>{riskError}</p>
        ) : riskLoading ? (
          <p>Loading the latest risk assessment...</p>
        ) : floodRisk ? (
          <>
            <p>
              {floodRisk.message ||
                "No additional risk message available."}
            </p>

            <div className="risk-details">
              <div>
                <span>Water level</span>
                <strong>
                  {Number.isFinite(Number(floodRisk.water_level_percent))
                    ? `${Number(floodRisk.water_level_percent).toFixed(1)}%`
                    : "N/A"}
                </strong>
              </div>

              <div>
                <span>Rise rate</span>
                <strong>
                  {Number.isFinite(Number(floodRisk.rise_rate_cm_per_min))
                    ? `${Number(floodRisk.rise_rate_cm_per_min).toFixed(1)} cm/min`
                    : "N/A"}
                </strong>
              </div>

              <div>
                <span>Forecast location</span>
                <strong>{floodRisk.forecast_location || "Meerut"}</strong>
              </div>

              <div>
                <span>Highest hourly rainfall</span>
                <strong>
                  {Number.isFinite(
                    Number(floodRisk.maximum_hourly_rainfall_mm)
                  )
                    ? `${Number(
                        floodRisk.maximum_hourly_rainfall_mm
                      ).toFixed(1)} mm`
                    : "N/A"}
                </strong>
              </div>
            </div>

            {Array.isArray(floodRisk.reasons) &&
              floodRisk.reasons.length > 0 && (
                <div className="risk-reasons">
                  <strong>Assessment reasons</strong>
                  <ul>
                    {floodRisk.reasons.map((reason, index) => (
                      <li key={`${reason}-${index}`}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

            <p className="risk-disclaimer">
              This category is based on configured thresholds and available
              readings. It is not a validated city-wide flood prediction.
            </p>
          </>
        ) : (
          <p>Risk assessment is not available.</p>
        )}
      </section>

      {/* Weather forecast */}
      <section className="weather-section">
        <div className="section-heading forecast-heading">
          <div>
            <p className="eyebrow">WEATHER DATA</p>
            <h3>Meerut Rainfall Forecast</h3>
            <p>Hourly precipitation forecast from Open-Meteo.</p>
          </div>

          <span className="forecast-badge">
            <span className="live-dot" />
            {weather
              ? "Weather connected"
              : weatherLoading
                ? "Loading weather"
                : "Weather unavailable"}
          </span>
        </div>

        {weatherError ? (
          <div className="weather-error">
            <strong>Unable to load weather data</strong>
            <p>{weatherError}</p>
          </div>
        ) : weatherLoading ? (
          <div className="weather-empty">
            <p>Loading rainfall forecast...</p>
          </div>
        ) : weather?.hourly_forecast?.length ? (
          <>
            <div className="weather-summary">
              <article className="weather-summary-card">
                <span>Forecast hours</span>
                <strong>{weather.hourly_forecast.length}</strong>
              </article>

              <article className="weather-summary-card">
                <span>Highest hourly rainfall</span>
                <strong>
                  {maximumRainfall === null
                    ? "N/A"
                    : `${maximumRainfall.toFixed(1)} mm`}
                </strong>
              </article>

              <article className="weather-summary-card">
                <span>Sum of forecast values</span>
                <strong>
                  {totalRainfall === null
                    ? "N/A"
                    : `${totalRainfall.toFixed(1)} mm`}
                </strong>
              </article>
            </div>

            <div className="rainfall-grid">
              {weather.hourly_forecast.map((item, index) => (
                <article
                  className="rainfall-card"
                  key={`${item.time}-${index}`}
                >
                  <span>
                    {new Date(item.time).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Asia/Kolkata",
                    })}
                  </span>

                  <strong>
                    {item.precipitation_mm == null ||
                    !Number.isFinite(Number(item.precipitation_mm))
                      ? "N/A"
                      : `${Number(item.precipitation_mm).toFixed(1)} mm`}
                  </strong>

                  <small>Forecast precipitation</small>
                </article>
              ))}
            </div>

            <div className="rainfall-chart">
              <h3>Hourly Rainfall Trend</h3>
              <p className="chart-description">
                Forecast precipitation by hour, measured in millimetres.
              </p>

              {rainfallChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart
                    data={rainfallChartData}
                    margin={{
                      top: 15,
                      right: 20,
                      left: 8,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e2e8f0"
                    />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      tickMargin={10}
                    />
                    <YAxis
                      width={55}
                      allowDecimals
                      domain={[0, "auto"]}
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      label={{
                        value: "Rainfall (mm)",
                        angle: -90,
                        position: "insideLeft",
                        style: {
                          textAnchor: "middle",
                          fill: "#64748b",
                        },
                      }}
                    />
                    <Tooltip
                      formatter={(value) => [
                        value == null
                          ? "N/A"
                          : `${Number(value).toFixed(1)} mm`,
                        "Precipitation",
                      ]}
                      labelFormatter={(label) => `Time: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="rainfall"
                      name="Rainfall"
                      stroke="#0284c7"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#0284c7" }}
                      activeDot={{ r: 6 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p>No valid rainfall values are available.</p>
              )}
            </div>

            <p className="weather-source">
              Source: {weather.source || "Open-Meteo"} · Units:{" "}
              {weather.precipitation_unit || "mm"}
              {weather.fetched_at &&
                ` · Retrieved: ${new Date(
                  weather.fetched_at
                ).toLocaleTimeString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}`}
            </p>
          </>
        ) : (
          <div className="weather-empty">
            <p>No hourly forecast data is available.</p>
          </div>
        )}
      </section>

      {/* Forecast development status */}
      <section className="forecast-section">
        <div className="section-heading forecast-heading">
          <div>
            <p className="eyebrow">PREDICTIVE INTELLIGENCE</p>
            <h3>0–3 Hour Flood Forecast</h3>
            <p>
              Rainfall forecasts are available, but future water levels have
              not yet been calculated by a validated prediction model.
            </p>
          </div>
          <span className="forecast-badge">In development</span>
        </div>

        <div className="forecast-grid">
          <article className="forecast-card">
            <span className="forecast-time">NOW</span>
            <div className="forecast-symbol">◉</div>
            <h4>Current conditions</h4>
            <p>
              {reading
                ? "Live sensor reading available"
                : "Waiting for live sensor data"}
            </p>
            <span className="forecast-state">
              {reading ? "Sensor data" : "No reading"}
            </span>
          </article>

          <article className="forecast-card">
            <span className="forecast-time">+1 HOUR</span>
            <div className="forecast-symbol">⌁</div>
            <h4>Near-term outlook</h4>
            <p>
              Rainfall data is available; future flood levels are not
              predicted yet.
            </p>
            <span className="forecast-state unavailable">
              Prediction unavailable
            </span>
          </article>

          <article className="forecast-card">
            <span className="forecast-time">+2 HOURS</span>
            <div className="forecast-symbol">⌁</div>
            <h4>Mid-term outlook</h4>
            <p>
              Terrain and drainage modelling are still required.
            </p>
            <span className="forecast-state unavailable">
              Prediction unavailable
            </span>
          </article>

          <article className="forecast-card">
            <span className="forecast-time">+3 HOURS</span>
            <div className="forecast-symbol">⌁</div>
            <h4>Extended outlook</h4>
            <p>
              A validated flood prediction model is still required.
            </p>
            <span className="forecast-state unavailable">
              Prediction unavailable
            </span>
          </article>
        </div>

        <div className="forecast-notice">
          <span className="notice-icon">i</span>
          <p>
            <strong>Future flood predictions are not active yet.</strong>{" "}
            The risk assessment above uses configured thresholds; it does not
            predict future flood levels.
          </p>
        </div>
      </section>

      {/* Data source readiness */}
      <section className="readiness-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SYSTEM READINESS</p>
            <h3>Data Sources &amp; Prediction Readiness</h3>
            <p>
              Inputs needed to extend the prototype into a validated
              flood-monitoring system.
            </p>
          </div>
        </div>

        <div className="source-list">
          {dataSources.map((source) => (
            <article className="source-row" key={source.name}>
              <span
                className={`source-indicator ${source.ready ? "ready" : ""}`}
              />
              <div className="source-copy">
                <strong>{source.name}</strong>
                <p>{source.detail}</p>
              </div>
              <span
                className={`source-status ${source.ready ? "ready" : ""}`}
              >
                {source.state}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="next-step">
        <div className="next-step-icon">→</div>
        <div>
          <p className="eyebrow">NEXT DEVELOPMENT MILESTONE</p>
          <h3>Integrate geographic and drainage data</h3>
          <p>
            Add terrain elevation, drainage networks, and vulnerable-area
            mapping before developing and validating future flood predictions.
          </p>
        </div>
      </section>

      <footer>
        <span>FloodWatch · SIH 26085 prototype</span>
        <span>Sensor polling: 2 seconds · Weather and risk refresh: 5–10 seconds/minutes</span>
      </footer>
    </main>
  );
}

export default App;

import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000/latest-reading";

function App() {
  const [reading, setReading] = useState(null);
  const [connection, setConnection] = useState("Connecting");
  const [lastChecked, setLastChecked] = useState(null);

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
        if (active) {
          setConnection("Disconnected");
        }
      }
    }

    fetchReading();
    const interval = setInterval(fetchReading, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const rapidRise = reading?.status === "RAPID_RISE";

  const dataSources = [
    {
      name: "Live water-level sensor",
      detail: "ESP8266 readings from your current monitoring setup",
      state: reading ? "Available" : "Waiting",
      ready: Boolean(reading),
    },
    {
      name: "Rainfall observations and forecast",
      detail: "Required to estimate incoming rainfall",
      state: "Not connected",
      ready: false,
    },
    {
      name: "Terrain elevation data",
      detail: "Required to understand low-lying flood-prone areas",
      state: "Not connected",
      ready: false,
    },
    {
      name: "Drainage network and capacity",
      detail: "Drain connections, flow capacity, and blockage information",
      state: "Not connected",
      ready: false,
    },
    {
      name: "Flood prediction model",
      detail: "Needs suitable data, model development, and validation",
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
            <p>Urban Flood Nowcasting System</p>
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
          <h2>Flood Monitoring & Risk Overview</h2>
          <p className="subtitle">
            Live water monitoring today, predictive flood intelligence next.
          </p>
        </div>

        <div className="location">
          <span>⌖</span>
          <div>
            <strong>Drain 01</strong>
            <small>Location ID: {reading?.location_id || "drain_01"}</small>
          </div>
        </div>
      </section>

      <section className="section-heading">
        <div>
          <h3>Live monitoring</h3>
          <p>Measurements received from your existing sensor system.</p>
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
              <p>Measured water depth in the monitored container</p>
            </article>

            <article className="metric-card rate-card">
              <div className="metric-heading">
                <span>Water rise rate</span>
                <span className="metric-icon">↗</span>
              </div>
              <div className="metric-value">
                {Number(reading.rise_rate_cm_per_min ?? 0).toFixed(1)}
                <span> cm/min</span>
              </div>
              <p>Reported rate of change in water level</p>
            </article>

            <article
              className={`metric-card status-card ${rapidRise ? "danger" : ""}`}
            >
              <div className="metric-heading">
                <span>Sensor warning</span>
                <span className="metric-icon">
                  {rapidRise ? "!" : "✓"}
                </span>
              </div>
              <div className="status-value">
                {reading.status || "NORMAL"}
              </div>
              <p>
                {rapidRise
                  ? "Rapid water rise reported by the sensor"
                  : "No rapid-rise alert reported by the sensor"}
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
                  ? new Date(reading.received_at).toLocaleString()
                  : "Timestamp unavailable"}
              </strong>
            </div>
            <div>
              <span className="detail-label">Dashboard checked</span>
              <strong>
                {lastChecked ? lastChecked.toLocaleTimeString() : "—"}
              </strong>
            </div>
          </section>
        </>
      )}

      <section className="forecast-section">
        <div className="section-heading forecast-heading">
          <div>
            <p className="eyebrow">PREDICTIVE INTELLIGENCE</p>
            <h3>0–3 Hour Flood Forecast</h3>
            <p>
              The next stage: estimate future flood conditions using rainfall,
              terrain, drainage, and sensor data.
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
            <p>Rainfall forecast and prediction model required.</p>
            <span className="forecast-state unavailable">
              Not available
            </span>
          </article>

          <article className="forecast-card">
            <span className="forecast-time">+2 HOURS</span>
            <div className="forecast-symbol">⌁</div>
            <h4>Mid-term outlook</h4>
            <p>Terrain and drainage modelling required.</p>
            <span className="forecast-state unavailable">
              Not available
            </span>
          </article>

          <article className="forecast-card">
            <span className="forecast-time">+3 HOURS</span>
            <div className="forecast-symbol">⌁</div>
            <h4>Extended outlook</h4>
            <p>Validated flood prediction model required.</p>
            <span className="forecast-state unavailable">
              Not available
            </span>
          </article>
        </div>

        <div className="forecast-notice">
          <span className="notice-icon">i</span>
          <p>
            <strong>Forecasts are not active yet.</strong> The future time
            slots are placeholders, not predicted water levels or verified
            flood-risk estimates.
          </p>
        </div>
      </section>

      <section className="readiness-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SYSTEM READINESS</p>
            <h3>Data Sources & Prediction Readiness</h3>
            <p>
              Track the inputs needed to turn this prototype into a flood
              nowcasting system.
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
          <h3>Connect rainfall data</h3>
          <p>
            Integrate a real weather-data source into FastAPI, then use
            rainfall and sensor history as inputs for the first forecast
            prototype.
          </p>
        </div>
      </section>

      <footer>
        <span>FloodWatch · SIH 26085 prototype</span>
        <span>Live sensor polling every 2 seconds</span>
      </footer>
    </main>
  );
}

export default App;

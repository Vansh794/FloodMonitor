
import math
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


app = FastAPI(title="Smart Flood Monitoring System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- SENSOR MODEL ----------

class SensorReading(BaseModel):
    location_id: str = "drain_01"
    water_level_cm: float = Field(ge=0)
    rise_rate_cm_per_min: float = 0.0
    status: str = "NORMAL"

    # Additional ESP8266 fields
    water_zone: str = "UNKNOWN"
    gate_status: str = "UNKNOWN"
    diversion_status: str = "UNKNOWN"


latest_reading = None


# ---------- CONFIGURATION ----------

CONTAINER_DEPTH_CM = 30.0
RAPID_RISE_LIMIT = 3.0

HIGH_LEVEL_PERCENT = 80.0
MODERATE_LEVEL_PERCENT = 60.0

HIGH_RAINFALL_MM = 10.0
MODERATE_RAINFALL_MM = 5.0

MAX_READING_AGE_SECONDS = 30


# ---------- HELPER: INSUFFICIENT DATA ----------

def insufficient_data(message, location_id="drain_01"):
    return {
        "location_id": location_id,
        "risk_level": "INSUFFICIENT DATA",
        "message": message,
        "reasons": [],
        "assessed_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------- HOME ----------

@app.get("/")
def home():
    return {"message": "Flood Monitoring API is running"}


# ---------- RECEIVE SENSOR DATA ----------

@app.post("/sensor-data")
def receive_sensor_data(reading: SensorReading):
    global latest_reading

    latest_reading = reading.model_dump()
    latest_reading["received_at"] = datetime.now(
        timezone.utc
    ).isoformat()

    print("Received sensor data:", latest_reading)

    return {
        "message": "Sensor data received successfully",
        "data": latest_reading,
    }


# ---------- LATEST SENSOR READING ----------

@app.get("/latest-reading")
def get_latest_reading():
    if latest_reading is None:
        return {
            "message": "No sensor readings received yet"
        }

    return latest_reading.copy()


# ---------- WEATHER FORECAST ----------

@app.get("/weather-forecast")
async def get_weather_forecast():
    latitude = 28.9845
    longitude = 77.7064

    url = "https://api.open-meteo.com/v1/forecast"

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": "precipitation",
        "forecast_hours": 4,
        "timezone": "Asia/Kolkata",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

        hourly = data.get("hourly", {})
        times = hourly.get("time", [])
        precipitation = hourly.get("precipitation", [])

        if not times or len(times) != len(precipitation):
            raise HTTPException(
                status_code=502,
                detail="Weather provider returned incomplete forecast data",
            )

        return {
            "location": "Meerut",
            "latitude": data.get("latitude"),
            "longitude": data.get("longitude"),
            "source": "Open-Meteo",
            "forecast_type": "Hourly precipitation forecast",
            "precipitation_unit": "mm",
            "timezone": data.get("timezone", "Asia/Kolkata"),
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "hourly_forecast": [
                {
                    "time": time,
                    "precipitation_mm": rainfall,
                }
                for time, rainfall in zip(times, precipitation)
            ],
        }

    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=502,
            detail="Weather provider request failed",
        ) from error


# ---------- FLOOD RISK ASSESSMENT ----------

@app.get("/flood-risk")
async def get_flood_risk():

    if latest_reading is None:
        return insufficient_data(
            "Waiting for live sensor readings."
        )

    reading = latest_reading.copy()
    location_id = reading.get("location_id", "drain_01")

    # Check reading timestamp
    try:
        received_at = reading.get("received_at")

        reading_time = datetime.fromisoformat(
            received_at.replace("Z", "+00:00")
        )

        if reading_time.tzinfo is None:
            return insufficient_data(
                "Sensor timestamp has no timezone.",
                location_id,
            )

        age_seconds = (
            datetime.now(timezone.utc) - reading_time
        ).total_seconds()

        if (
            age_seconds > MAX_READING_AGE_SECONDS
            or age_seconds < -5
        ):
            return insufficient_data(
                "Sensor data is stale. Check the connection.",
                location_id,
            )

    except (AttributeError, TypeError, ValueError):
        return insufficient_data(
            "Sensor timestamp is missing or invalid.",
            location_id,
        )

    # Validate sensor measurements
    try:
        water_level = float(reading["water_level_cm"])
        rise_rate = float(reading["rise_rate_cm_per_min"])

        if not (
            math.isfinite(water_level)
            and math.isfinite(rise_rate)
            and 0 <= water_level <= CONTAINER_DEPTH_CM
        ):
            raise ValueError("Invalid sensor measurements")

    except (KeyError, TypeError, ValueError):
        return insufficient_data(
            "Sensor readings are invalid.",
            location_id,
        )

    # Fetch and validate rainfall forecast
    try:
        weather = await get_weather_forecast()

        rainfall_values = []

        for item in weather["hourly_forecast"]:
            value = item.get("precipitation_mm")

            if value is None:
                continue

            rainfall = float(value)

            if math.isfinite(rainfall) and rainfall >= 0:
                rainfall_values.append(rainfall)

        if not rainfall_values:
            raise ValueError("No valid rainfall forecast")

    except (
        HTTPException,
        KeyError,
        TypeError,
        ValueError,
        AttributeError,
    ):
        return insufficient_data(
            "Rainfall forecast is unavailable or invalid.",
            location_id,
        )

    maximum_rainfall = max(rainfall_values)
    level_percent = (
        water_level / CONTAINER_DEPTH_CM
    ) * 100

    # Determine risk from measured values
    reasons = []
    high_risk = False
    moderate_risk = False

    if rise_rate >= RAPID_RISE_LIMIT:
        high_risk = True
        reasons.append(
            f"Water rise rate is {rise_rate:.2f} cm/min."
        )

    if level_percent >= HIGH_LEVEL_PERCENT:
        high_risk = True
        reasons.append(
            f"Water level is at {level_percent:.1f}% "
            "of the demo container depth."
        )

    elif level_percent >= MODERATE_LEVEL_PERCENT:
        moderate_risk = True
        reasons.append(
            f"Water level is at {level_percent:.1f}% "
            "of the demo container depth."
        )

    if maximum_rainfall >= HIGH_RAINFALL_MM:
        high_risk = True
        reasons.append(
            f"Maximum forecast hourly rainfall is "
            f"{maximum_rainfall:.1f} mm."
        )

    elif maximum_rainfall >= MODERATE_RAINFALL_MM:
        moderate_risk = True
        reasons.append(
            f"Maximum forecast hourly rainfall is "
            f"{maximum_rainfall:.1f} mm."
        )

    # Assign final risk category
    if high_risk:
        risk_level = "HIGH"
        message = (
            "High-risk conditions detected. "
            "Verify local conditions."
        )

    elif moderate_risk:
        risk_level = "MODERATE"
        message = (
            "Monitor water levels and rainfall conditions."
        )

    else:
        risk_level = "LOW"
        message = (
            "No configured risk thresholds are currently crossed."
        )
        reasons.append(
            "Water level, measured rise rate, and forecast "
            "are below the configured risk thresholds."
        )

    # Return assessment and live gate/diversion information
    return {
        "location_id": location_id,
        "risk_level": risk_level,
        "message": message,
        "reasons": reasons,
        "water_level_cm": round(water_level, 2),
        "water_level_percent": round(level_percent, 1),
        "rise_rate_cm_per_min": round(rise_rate, 2),

        "status": reading.get("status", "UNKNOWN"),
        "water_zone": reading.get("water_zone", "UNKNOWN"),
        "gate_status": reading.get("gate_status", "UNKNOWN"),
        "diversion_status": reading.get(
            "diversion_status", "UNKNOWN"
        ),

        "maximum_hourly_rainfall_mm": round(
            maximum_rainfall, 2
        ),
        "forecast_location": weather.get(
            "location", "Meerut"
        ),
        "assessed_at": datetime.now(
            timezone.utc
        ).isoformat(),
    }

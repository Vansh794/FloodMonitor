import httpx
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="Smart Flood Monitoring System")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SensorReading(BaseModel):
    location_id: str = "drain_01"
    water_level_cm: float = Field(ge=0)
    rise_rate_cm_per_min: float = 0.0
    status: str = "NORMAL"


latest_reading = None


@app.get("/")
def home():
    return {"message": "Flood Monitoring API is running"}


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
        "data": latest_reading
    }


@app.get("/latest-reading")
def get_latest_reading():
    if latest_reading is None:
        return {"message": "No sensor readings received yet"}

    return latest_reading

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
            detail=f"Weather provider request failed: {error}",
        ) from error

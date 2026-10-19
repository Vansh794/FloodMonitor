
from datetime import datetime, timezone

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="Smart Flood Monitoring System")


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

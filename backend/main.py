from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import random

app = FastAPI()


class OlympiadCreate(BaseModel):
    name: str


class OlympiadResponse(BaseModel):
    name: str
    pin: str

# Enable CORS for React frontend
# In development, allow all origins so we can access from other devices on the network
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development - restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory data (will be replaced with database later)
# Format: {name: pin}
olympiads_db: dict[str, str] = {
    "Enniolimpiadi2025": "1234",
    "Enniolimpiadi2026": "5678"
}


def generate_pin() -> str:
    return f"{random.randint(0, 9999):04d}"


@app.get("/olympiads")
def get_olympiads():
    return list(olympiads_db.keys())


@app.post("/olympiads", response_model=OlympiadResponse)
def create_olympiad(olympiad: OlympiadCreate):
    pin = generate_pin()
    olympiads_db[olympiad.name] = pin
    return OlympiadResponse(name=olympiad.name, pin=pin)

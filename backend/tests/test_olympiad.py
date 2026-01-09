import os
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from backend.src import database, main

@pytest.fixture(autouse=True)
def setup_test_db():
    """Create a fresh test database for each test."""
    db_path = Path(os.environ["OLYMPIAD_DATABASE_PATH"])
    schema_path = Path(os.environ["OLYMPIAD_SCHEMA_PATH"])

    # Remove existing test db
    if db_path.exists():
        db_path.unlink()

    # Initialize schema
    database.init_db(db_path, schema_path)

    yield

    # Cleanup
    if db_path.exists():
        db_path.unlink()

@pytest.fixture
def client():
    return TestClient(main.app, raise_server_exceptions=False)

class TestCreateOlympiad:
    def test_create_with_provided_pin(self, client):
        response = client.post("/olympiads", json={"name": "Test Olympiad", "pin": "1234"})

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Olympiad"
        assert data["pin"] == "1234"
        assert data["version"] == 1
        assert "id" in data

    def test_create_with_generated_pin(self, client):
        response = client.post("/olympiads", json={"name": "Test Olympiad"})

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Olympiad"
        assert len(data["pin"]) == 4
        assert data["pin"].isdigit()

    def test_create_returns_etag(self, client):
        response = client.post("/olympiads", json={"name": "Test Olympiad", "pin": "1234"})

        assert response.status_code == 201
        assert "ETag" in response.headers
        assert response.headers["ETag"] == '"1"'

    def test_create_duplicate_name_fails(self, client):
        client.post("/olympiads", json={"name": "Test Olympiad", "pin": "1234"})
        response = client.post("/olympiads", json={"name": "Test Olympiad", "pin": "5678"})

        assert response.status_code == 500  # IntegrityError

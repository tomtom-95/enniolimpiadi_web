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


@pytest.fixture
def olympiad(client):
    """Create an olympiad and return its ID."""
    response = client.post(
        "/olympiads",
        json={"name": "Test Olympiad"},
        headers={"X-Olympiad-PIN": "1234"}
    )
    return response.json()["id"]


class TestCreateOlympiad:
    def test_create_olympiad(self, client):
        response = client.post(
            "/olympiads",
            json={"name": "Test Olympiad"},
            headers={"X-Olympiad-PIN": "1234"}
        )

        assert response.status_code == 201

        assert "ETag" in response.headers
        assert response.headers["ETag"] == '"1"'

        assert "X-Olympiad-PIN" in response.headers
        assert response.headers["X-Olympiad-PIN"] == "1234"

        data = response.json()
        assert data["name"] == "Test Olympiad"
        assert "id" in data

    def test_create_fails_without_pin_header(self, client):
        response = client.post(
            "/olympiads",
            json={"name": "Test Olympiad"}
        )

        assert response.status_code == 422  # Missing required header

    def test_create_fails_with_invalid_pin(self, client):
        response = client.post(
            "/olympiads",
            json={"name": "Test Olympiad"},
            headers={"X-Olympiad-PIN": "abc"}
        )

        assert response.status_code == 500  # AssertionError

    def test_create_fails_with_short_pin(self, client):
        response = client.post(
            "/olympiads",
            json={"name": "Test Olympiad"},
            headers={"X-Olympiad-PIN": "123"}
        )

        assert response.status_code == 500  # AssertionError

    def test_create_duplicate_name_fails(self, client):
        client.post(
            "/olympiads",
            json={"name": "Test Olympiad"},
            headers={"X-Olympiad-PIN": "1234"}
        )
        response = client.post(
            "/olympiads",
            json={"name": "Test Olympiad"},
            headers={"X-Olympiad-PIN": "5678"}
        )

        assert response.status_code == 409  # Duplicate name


class TestListPlayers:
    def test_list_players_empty(self, client, olympiad):
        response = client.get(f"/olympiads/{olympiad}/players")

        assert response.status_code == 200
        assert response.json() == []

    def test_list_players_with_players(self, client, olympiad):
        client.post(f"/olympiads/{olympiad}/players", json={"name": "Player 1"})
        client.post(f"/olympiads/{olympiad}/players", json={"name": "Player 2"})

        response = client.get(f"/olympiads/{olympiad}/players")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["name"] == "Player 1"
        assert data[1]["name"] == "Player 2"

    def test_list_players_olympiad_not_found(self, client):
        response = client.get("/olympiads/999/players")

        assert response.status_code == 404
        assert response.json()["detail"] == "Olimpiade non trovata"


class TestCreatePlayer:
    def test_create_player(self, client, olympiad):
        response = client.post(
            f"/olympiads/{olympiad}/players",
            json={"name": "Test Player"}
        )

        assert response.status_code == 201

        assert "ETag" in response.headers
        assert response.headers["ETag"] == '"1"'

        data = response.json()
        assert data["name"] == "Test Player"
        assert "id" in data

    def test_create_player_olympiad_not_found(self, client):
        response = client.post(
            "/olympiads/999/players",
            json={"name": "Test Player"}
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Olimpiade non trovata"

    def test_create_player_duplicate_name_fails(self, client, olympiad):
        client.post(
            f"/olympiads/{olympiad}/players",
            json={"name": "Test Player"}
        )

        response = client.post(
            f"/olympiads/{olympiad}/players",
            json={"name": "Test Player"}
        )

        assert response.status_code == 409
        assert response.json()["detail"] == "Giocatore con questo nome già esistente"

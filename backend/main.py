import random
import string
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import get_db, init_db
import queries as q


# =============================================================================
# Pydantic Schemas
# =============================================================================


# Olympiad schemas
class OlympiadCreate(BaseModel):
    name: str
    pin: Optional[str] = None


class OlympiadResponse(BaseModel):
    id: int
    name: str


class OlympiadCreateResponse(BaseModel):
    id: int
    name: str
    pin: str


class OlympiadDetail(BaseModel):
    id: int
    name: str
    players: list["PlayerResponse"]
    teams: list["TeamResponse"]
    events: list["EventResponse"]


# Player schemas
class PlayerCreate(BaseModel):
    name: str


class PlayerResponse(BaseModel):
    id: int
    name: str
    team_id: int | None = None


# Team schemas
class TeamCreate(BaseModel):
    name: str
    player_ids: list[int] = []


class TeamResponse(BaseModel):
    id: int
    name: str


class TeamDetail(BaseModel):
    id: int
    name: str
    players: list[PlayerResponse]


# Event schemas
class EventCreate(BaseModel):
    name: str
    score_kind: str  # 'points' or 'outcome'


class EventUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None  # 'registration', 'started', 'finished'


class EventResponse(BaseModel):
    id: int
    name: str
    status: str
    score_kind: str


class EventDetail(BaseModel):
    id: int
    name: str
    status: str
    score_kind: str
    teams: list[TeamResponse]


class VerifyPinRequest(BaseModel):
    pin: str


# =============================================================================
# Helper Functions
# =============================================================================


def generate_pin() -> str:
    """Generate a random 4-digit PIN."""
    return ''.join(random.choices(string.digits, k=4))


def verify_olympiad_pin(conn, olympiad_id: int, pin: str) -> bool:
    """Verify if the provided PIN matches the olympiad's PIN."""
    cursor = conn.execute(q.OLYMPIAD_VERIFY_PIN, (olympiad_id, pin))
    return cursor.fetchone() is not None


# =============================================================================
# Database Dependency
# =============================================================================


def db_dependency():
    """FastAPI dependency for database connection."""
    with get_db() as conn:
        yield conn


def verified_olympiad(
    olympiad_id: int,
    x_olympiad_pin: str = Header(...),
    conn=Depends(db_dependency)
):
    """Dependency that verifies the olympiad exists and PIN is valid."""
    cursor = conn.execute(q.OLYMPIAD_EXISTS, (olympiad_id,))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Olympiad not found")

    if not verify_olympiad_pin(conn, olympiad_id, x_olympiad_pin):
        raise HTTPException(status_code=401, detail="Invalid PIN")

    return conn


# =============================================================================
# App Setup
# =============================================================================


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Olympiad Endpoints
# =============================================================================


@app.get("/olympiads", response_model=list[OlympiadResponse])
def list_olympiads(conn=Depends(db_dependency)):
    """List all olympiads."""
    cursor = conn.execute(q.OLYMPIAD_LIST)
    return [OlympiadResponse(id=row["id"], name=row["name"]) for row in cursor.fetchall()]


@app.get("/olympiads/{olympiad_id}", response_model=OlympiadDetail)
def get_olympiad(olympiad_id: int, conn=Depends(db_dependency)):
    """Get full olympiad details including players, teams, and events."""
    cursor = conn.execute(q.OLYMPIAD_GET, (olympiad_id,))
    olympiad = cursor.fetchone()
    if not olympiad:
        raise HTTPException(status_code=404, detail="Olympiad not found")

    cursor = conn.execute(q.PLAYER_LIST, (olympiad_id,))
    players = [PlayerResponse(id=row["id"], name=row["name"]) for row in cursor.fetchall()]

    cursor = conn.execute(q.TEAM_LIST, (olympiad_id,))
    teams = [TeamResponse(id=row["id"], name=row["name"]) for row in cursor.fetchall()]

    cursor = conn.execute(q.EVENT_LIST, (olympiad_id,))
    events = [
        EventResponse(id=row["id"], name=row["name"], status=row["status"], score_kind=row["score_kind"])
        for row in cursor.fetchall()
    ]

    return OlympiadDetail(
        id=olympiad["id"],
        name=olympiad["name"],
        players=players,
        teams=teams,
        events=events,
    )


@app.post("/olympiads", response_model=OlympiadCreateResponse)
def create_olympiad(data: OlympiadCreate, conn=Depends(db_dependency)):
    """Create a new olympiad with a provided or generated PIN."""
    if data.pin is not None:
        if len(data.pin) != 4 or not data.pin.isdigit():
            raise HTTPException(status_code=400, detail="PIN must be exactly 4 digits")
        pin = data.pin
    else:
        pin = generate_pin()

    try:
        cursor = conn.execute(q.OLYMPIAD_CREATE, (data.name, pin))
        row = cursor.fetchone()
        return OlympiadCreateResponse(id=row["id"], name=row["name"], pin=row["pin"])
    except Exception as e:
        if "UNIQUE constraint failed" in str(e):
            raise HTTPException(status_code=400, detail="Olympiad name already exists")
        raise


@app.post("/olympiads/{olympiad_id}/verify-pin")
def verify_pin(olympiad_id: int, data: VerifyPinRequest, conn=Depends(db_dependency)):
    """Verify if the provided PIN is correct for the olympiad."""
    cursor = conn.execute(q.OLYMPIAD_EXISTS, (olympiad_id,))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Olympiad not found")

    if not verify_olympiad_pin(conn, olympiad_id, data.pin):
        raise HTTPException(status_code=401, detail="Invalid PIN")

    return {"valid": True}


@app.put("/olympiads/{olympiad_id}", response_model=OlympiadResponse)
def update_olympiad(olympiad_id: int, data: OlympiadCreate, conn=Depends(verified_olympiad)):
    """Update olympiad name. Requires PIN in X-Olympiad-PIN header."""
    try:
        cursor = conn.execute(q.OLYMPIAD_UPDATE, (data.name, olympiad_id))
        row = cursor.fetchone()
        return OlympiadResponse(id=row["id"], name=row["name"])
    except Exception as e:
        if "UNIQUE constraint failed" in str(e):
            raise HTTPException(status_code=400, detail="Olympiad name already exists")
        raise


@app.delete("/olympiads/{olympiad_id}")
def delete_olympiad(olympiad_id: int, conn=Depends(verified_olympiad)):
    """Delete an olympiad and all its data. Requires PIN in X-Olympiad-PIN header."""
    conn.execute(q.OLYMPIAD_DELETE, (olympiad_id,))
    return {"message": "Olympiad deleted"}


# =============================================================================
# Player Endpoints
# =============================================================================


@app.get("/olympiads/{olympiad_id}/players", response_model=list[PlayerResponse])
def list_players(olympiad_id: int, conn=Depends(db_dependency)):
    """List all players in an olympiad."""
    cursor = conn.execute(q.OLYMPIAD_EXISTS, (olympiad_id,))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Olympiad not found")

    cursor = conn.execute(q.PLAYER_LIST, (olympiad_id,))
    return [PlayerResponse(id=row["id"], name=row["name"]) for row in cursor.fetchall()]


@app.post("/olympiads/{olympiad_id}/players", response_model=PlayerResponse)
def create_player(olympiad_id: int, data: PlayerCreate, conn=Depends(verified_olympiad)):
    """Create a new player in an olympiad. Requires PIN in X-Olympiad-PIN header."""
    try:
        # Create the player
        cursor = conn.execute(q.PLAYER_CREATE, (olympiad_id, data.name))
        player_row = cursor.fetchone()
        player_id = player_row["id"]
        player_name = player_row["name"]

        # Create a single-player team with the same name
        cursor = conn.execute(q.PLAYER_TEAM_CREATE, (olympiad_id, player_name))
        team_row = cursor.fetchone()
        team_id = team_row["id"]

        # Link the player to the team
        conn.execute(q.TEAM_PLAYER_ADD, (team_id, player_id))

        return PlayerResponse(id=player_id, name=player_name, team_id=team_id)
    except Exception as e:
        if "UNIQUE constraint failed" in str(e):
            raise HTTPException(status_code=400, detail="Player name already exists in this olympiad")
        raise


@app.put("/olympiads/{olympiad_id}/players/{player_id}", response_model=PlayerResponse)
def update_player(olympiad_id: int, player_id: int, data: PlayerCreate, conn=Depends(verified_olympiad)):
    """Update a player's name. Requires PIN in X-Olympiad-PIN header."""
    cursor = conn.execute(q.PLAYER_EXISTS, (player_id, olympiad_id))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Player not found")

    try:
        cursor = conn.execute(q.PLAYER_UPDATE, (data.name, player_id))
        row = cursor.fetchone()
        return PlayerResponse(id=row["id"], name=row["name"])
    except Exception as e:
        if "UNIQUE constraint failed" in str(e):
            raise HTTPException(status_code=400, detail="Player name already exists in this olympiad")
        raise


@app.delete("/olympiads/{olympiad_id}/players/{player_id}")
def delete_player(olympiad_id: int, player_id: int, conn=Depends(verified_olympiad)):
    """Delete a player from an olympiad. Requires PIN in X-Olympiad-PIN header."""
    cursor = conn.execute(q.PLAYER_EXISTS, (player_id, olympiad_id))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Player not found")

    conn.execute(q.PLAYER_DELETE, (player_id,))
    return {"message": "Player deleted"}


# =============================================================================
# Team Endpoints
# =============================================================================


@app.get("/olympiads/{olympiad_id}/teams", response_model=list[TeamResponse])
def list_teams(olympiad_id: int, conn=Depends(db_dependency)):
    """List all teams with more than one player in an olympiad."""
    cursor = conn.execute(q.OLYMPIAD_EXISTS, (olympiad_id,))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Olympiad not found")

    cursor = conn.execute(q.TEAM_LIST, (olympiad_id,))
    return [TeamResponse(id=row["id"], name=row["name"]) for row in cursor.fetchall()]


@app.get("/olympiads/{olympiad_id}/teams/{team_id}", response_model=TeamDetail)
def get_team(olympiad_id: int, team_id: int, conn=Depends(db_dependency)):
    """Get team details including players."""
    cursor = conn.execute(q.TEAM_GET, (team_id, olympiad_id))
    team = cursor.fetchone()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    cursor = conn.execute(q.TEAM_PLAYERS_LIST, (team_id,))
    players = [PlayerResponse(id=row["id"], name=row["name"]) for row in cursor.fetchall()]

    return TeamDetail(id=team["id"], name=team["name"], players=players)


@app.post("/olympiads/{olympiad_id}/teams", response_model=TeamResponse)
def create_team(olympiad_id: int, data: TeamCreate, conn=Depends(verified_olympiad)):
    """Create a new team in an olympiad. Requires PIN in X-Olympiad-PIN header."""
    try:
        cursor = conn.execute(q.TEAM_CREATE, (olympiad_id, data.name))
        row = cursor.fetchone()
        team_id = row["id"]

        for player_id in data.player_ids:
            conn.execute(q.TEAM_PLAYER_ADD, (team_id, player_id))

        return TeamResponse(id=team_id, name=row["name"])
    except Exception as e:
        if "UNIQUE constraint failed" in str(e):
            raise HTTPException(status_code=400, detail="Team name already exists in this olympiad")
        if "FOREIGN KEY constraint failed" in str(e):
            raise HTTPException(status_code=400, detail="One or more player IDs are invalid")
        raise


@app.put("/olympiads/{olympiad_id}/teams/{team_id}", response_model=TeamResponse)
def update_team(olympiad_id: int, team_id: int, data: TeamCreate, conn=Depends(verified_olympiad)):
    """Update a team's name and players. Requires PIN in X-Olympiad-PIN header."""
    cursor = conn.execute(q.TEAM_EXISTS, (team_id, olympiad_id))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Team not found")

    try:
        cursor = conn.execute(q.TEAM_UPDATE, (data.name, team_id))
        row = cursor.fetchone()

        conn.execute(q.TEAM_PLAYERS_CLEAR, (team_id,))
        for player_id in data.player_ids:
            conn.execute(q.TEAM_PLAYER_ADD, (team_id, player_id))

        return TeamResponse(id=row["id"], name=row["name"])
    except Exception as e:
        if "UNIQUE constraint failed" in str(e):
            raise HTTPException(status_code=400, detail="Team name already exists in this olympiad")
        if "FOREIGN KEY constraint failed" in str(e):
            raise HTTPException(status_code=400, detail="One or more player IDs are invalid")
        raise


@app.delete("/olympiads/{olympiad_id}/teams/{team_id}")
def delete_team(olympiad_id: int, team_id: int, conn=Depends(verified_olympiad)):
    """Delete a team from an olympiad. Requires PIN in X-Olympiad-PIN header."""
    cursor = conn.execute(q.TEAM_EXISTS, (team_id, olympiad_id))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Team not found")

    conn.execute(q.TEAM_DELETE, (team_id,))
    return {"message": "Team deleted"}


# =============================================================================
# Team Player Management
# =============================================================================


@app.post("/olympiads/{olympiad_id}/teams/{team_id}/players/{player_id}")
def add_player_to_team(olympiad_id: int, team_id: int, player_id: int, conn=Depends(verified_olympiad)):
    """Add a player to a team. Requires PIN in X-Olympiad-PIN header."""
    cursor = conn.execute(q.TEAM_EXISTS, (team_id, olympiad_id))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Team not found")

    cursor = conn.execute(q.PLAYER_EXISTS, (player_id, olympiad_id))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Player not found")

    try:
        conn.execute(q.TEAM_PLAYER_ADD, (team_id, player_id))
        return {"message": "Player added to team"}
    except Exception as e:
        if "UNIQUE constraint failed" in str(e) or "PRIMARY KEY constraint failed" in str(e):
            raise HTTPException(status_code=400, detail="Player already in team")
        raise


@app.delete("/olympiads/{olympiad_id}/teams/{team_id}/players/{player_id}")
def remove_player_from_team(olympiad_id: int, team_id: int, player_id: int, conn=Depends(verified_olympiad)):
    """Remove a player from a team. Requires PIN in X-Olympiad-PIN header."""
    cursor = conn.execute(q.TEAM_EXISTS, (team_id, olympiad_id))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Team not found")

    cursor = conn.execute(q.TEAM_PLAYER_EXISTS, (team_id, player_id))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Player not in team")

    conn.execute(q.TEAM_PLAYER_REMOVE, (team_id, player_id))
    return {"message": "Player removed from team"}


# =============================================================================
# Event Endpoints
# =============================================================================


@app.get("/olympiads/{olympiad_id}/events", response_model=list[EventResponse])
def list_events(olympiad_id: int, conn=Depends(db_dependency)):
    """List all events in an olympiad."""
    cursor = conn.execute(q.OLYMPIAD_EXISTS, (olympiad_id,))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Olympiad not found")

    cursor = conn.execute(q.EVENT_LIST, (olympiad_id,))
    return [
        EventResponse(id=row["id"], name=row["name"], status=row["status"], score_kind=row["score_kind"])
        for row in cursor.fetchall()
    ]


@app.get("/olympiads/{olympiad_id}/events/{event_id}", response_model=EventDetail)
def get_event(olympiad_id: int, event_id: int, conn=Depends(db_dependency)):
    """Get event details including enrolled teams."""
    cursor = conn.execute(q.EVENT_GET, (event_id, olympiad_id))
    event = cursor.fetchone()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    cursor = conn.execute(q.EVENT_TEAMS_LIST, (event_id,))
    teams = [TeamResponse(id=row["id"], name=row["name"]) for row in cursor.fetchall()]

    return EventDetail(
        id=event["id"],
        name=event["name"],
        status=event["status"],
        score_kind=event["score_kind"],
        teams=teams,
    )


@app.post("/olympiads/{olympiad_id}/events", response_model=EventResponse)
def create_event(olympiad_id: int, data: EventCreate, conn=Depends(verified_olympiad)):
    """Create a new event in an olympiad. Requires PIN in X-Olympiad-PIN header."""
    if data.score_kind not in ("points", "outcome"):
        raise HTTPException(status_code=400, detail="score_kind must be 'points' or 'outcome'")

    try:
        cursor = conn.execute(q.EVENT_CREATE, (olympiad_id, data.name, data.score_kind))
        row = cursor.fetchone()
        return EventResponse(
            id=row["id"], name=row["name"], status=row["status"], score_kind=row["score_kind"]
        )
    except Exception as e:
        if "UNIQUE constraint failed" in str(e):
            raise HTTPException(status_code=400, detail="Event name already exists in this olympiad")
        raise


@app.put("/olympiads/{olympiad_id}/events/{event_id}", response_model=EventResponse)
def update_event(olympiad_id: int, event_id: int, data: EventUpdate, conn=Depends(verified_olympiad)):
    """Update an event's name or status. Requires PIN in X-Olympiad-PIN header."""
    cursor = conn.execute(q.EVENT_GET, (event_id, olympiad_id))
    event = cursor.fetchone()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    new_name = data.name if data.name is not None else event["name"]
    new_status = data.status if data.status is not None else event["status"]

    if new_status not in ("registration", "started", "finished"):
        raise HTTPException(status_code=400, detail="Invalid status")

    try:
        cursor = conn.execute(q.EVENT_UPDATE, (new_name, new_status, event_id))
        row = cursor.fetchone()
        return EventResponse(
            id=row["id"], name=row["name"], status=row["status"], score_kind=row["score_kind"]
        )
    except Exception as e:
        if "UNIQUE constraint failed" in str(e):
            raise HTTPException(status_code=400, detail="Event name already exists in this olympiad")
        raise


@app.delete("/olympiads/{olympiad_id}/events/{event_id}")
def delete_event(olympiad_id: int, event_id: int, conn=Depends(verified_olympiad)):
    """Delete an event. Requires PIN in X-Olympiad-PIN header."""
    cursor = conn.execute(q.EVENT_EXISTS, (event_id, olympiad_id))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Event not found")

    conn.execute(q.EVENT_DELETE, (event_id,))
    return {"message": "Event deleted"}


# =============================================================================
# Event Team Enrollment
# =============================================================================


class TeamEnrollment(BaseModel):
    seed: Optional[int] = None


@app.post("/olympiads/{olympiad_id}/events/{event_id}/teams/{team_id}")
def enroll_team(
    olympiad_id: int,
    event_id: int,
    team_id: int,
    data: TeamEnrollment = TeamEnrollment(),
    conn=Depends(verified_olympiad)
):
    """Enroll a team in an event. Requires PIN in X-Olympiad-PIN header."""
    cursor = conn.execute(q.EVENT_EXISTS, (event_id, olympiad_id))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Event not found")

    cursor = conn.execute(q.TEAM_EXISTS, (team_id, olympiad_id))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Team not found")

    try:
        conn.execute(q.EVENT_TEAM_ENROLL, (event_id, team_id, data.seed))
        return {"message": "Team enrolled"}
    except Exception as e:
        if "UNIQUE constraint failed" in str(e) or "PRIMARY KEY constraint failed" in str(e):
            raise HTTPException(status_code=400, detail="Team already enrolled")
        raise


@app.put("/olympiads/{olympiad_id}/events/{event_id}/teams/{team_id}")
def update_team_enrollment(
    olympiad_id: int,
    event_id: int,
    team_id: int,
    data: TeamEnrollment,
    conn=Depends(verified_olympiad)
):
    """Update a team's seed in an event. Requires PIN in X-Olympiad-PIN header."""
    cursor = conn.execute(q.EVENT_TEAM_EXISTS, (event_id, team_id))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Team not enrolled in event")

    conn.execute(q.EVENT_TEAM_UPDATE, (data.seed, event_id, team_id))
    return {"message": "Team enrollment updated"}


@app.delete("/olympiads/{olympiad_id}/events/{event_id}/teams/{team_id}")
def unenroll_team(olympiad_id: int, event_id: int, team_id: int, conn=Depends(verified_olympiad)):
    """Remove a team from an event. Requires PIN in X-Olympiad-PIN header."""
    cursor = conn.execute(q.EVENT_TEAM_EXISTS, (event_id, team_id))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Team not enrolled in event")

    conn.execute(q.EVENT_TEAM_REMOVE, (event_id, team_id))
    return {"message": "Team unenrolled"}

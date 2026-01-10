import logging
import math
import os
import random
import sqlite3
import string
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from backend.src import database, queries

DATABASE_PATH = Path(os.environ["OLYMPIAD_DATABASE_PATH"])
SCHEMA_PATH = Path(os.environ["OLYMPIAD_SCHEMA_PATH"])

# =============================================================================
# Logging Setup
# =============================================================================

LOG_DIR = Path(os.environ["OLYMPIAD_LOG_DIR"])
LOG_DIR.mkdir(exist_ok=True)

log_formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")

# Backend logger
logger = logging.getLogger("olympiad")
logger.setLevel(logging.ERROR)
backend_handler = RotatingFileHandler(
    LOG_DIR / "backend.log",
    maxBytes=5 * 1024 * 1024,  # 5 MB
    backupCount=5
)
backend_handler.setFormatter(log_formatter)
logger.addHandler(backend_handler)

# Frontend logger
frontend_logger = logging.getLogger("frontend")
frontend_logger.setLevel(logging.ERROR)
frontend_handler = RotatingFileHandler(
    LOG_DIR / "frontend.log",
    maxBytes=5 * 1024 * 1024,  # 5 MB
    backupCount=5
)
frontend_handler.setFormatter(log_formatter)
frontend_logger.addHandler(frontend_handler)

# =============================================================================
# Pydantic Schemas
# =============================================================================


class OlympiadName(BaseModel):
    name: str

class OlympiadIdName(BaseModel):
    id: int
    name: str

class OlympiadIdNameVersion(BaseModel):
    id: int
    name: str
    version: int

class OlympiadIdPinVersion(BaseModel):
    id: int
    pin: str
    version: int

# class OlympiadDetail(BaseModel):
#     id: int
#     name: str
#     version: int
#     players: list["PlayerResponse"]
#     teams: list["TeamResponse"]
#     events: list["EventResponse"]

class PlayerIdName(BaseModel):
    id: int
    name: str

class PlayerName(BaseModel):
    name: str

class PlayerIdNameVersion(BaseModel):
    id: int
    name: str
    version: int

class PlayerResponse(BaseModel):
    id: int
    name: str
    team_id: int | None = None
    version: int = 1


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


# Stage schemas
class StageKindResponse(BaseModel):
    kind: str
    label: str


class ForeignKeyPragmaResponse(BaseModel):
    res: int


# Logging schemas
class FrontendLogRequest(BaseModel):
    level: str  # 'error', 'warn', 'info'
    message: str
    stack: Optional[str] = None
    url: Optional[str] = None
    userAgent: Optional[str] = None


class StageConfig(BaseModel):
    kind: str  # 'round_robin' or 'single_elimination'
    advance_count: Optional[int] = None


class EventCreateWithStages(BaseModel):
    name: str
    score_kind: str  # 'points' or 'outcome'
    stages: list[StageConfig]
    team_ids: list[int]


class MatchTeamResponse(BaseModel):
    id: int
    name: str
    score: Optional[int] = None


class MatchResponse(BaseModel):
    id: int
    status: str
    teams: list[MatchTeamResponse]
    next_match_id: Optional[int] = None


class StageResponse(BaseModel):
    id: int
    kind: str
    status: str
    stage_order: int
    advance_count: Optional[int]
    matches: list[MatchResponse]


class EventDetailWithBracket(BaseModel):
    id: int
    name: str
    status: str
    score_kind: str
    teams: list[TeamResponse]
    stages: list[StageResponse]

# =============================================================================
# Helper Functions
# =============================================================================


# def verify_olympiad_pin(conn, olympiad_id: int, pin: Optional[str]) -> bool:
#     """Verify if the provided PIN matches the olympiad's PIN."""
#     cursor = conn.execute(queries.OLYMPIAD_VERIFY_PIN, (olympiad_id, pin))
#     return cursor.fetchone() is not None


def create_single_elimination_bracket(
    conn, _stage_id: int, group_id: int, team_ids: list[int]
) -> list[int]:
    """
    Create a single elimination bracket structure.
    Returns list of match IDs in bracket order.

    For N teams:
    - Number of rounds = ceil(log2(N))
    - Total matches = N - 1
    - Byes are given to top seeds if N is not a power of 2
    """
    n_teams = len(team_ids)
    if n_teams < 2:
        return []

    # Calculate bracket size (next power of 2)
    n_rounds = math.ceil(math.log2(n_teams))
    bracket_size = 2 ** n_rounds
    # n_byes = bracket_size - n_teams  # Number of byes for incomplete brackets

    # Create all matches for the bracket
    # Total matches = bracket_size - 1
    total_matches = bracket_size - 1
    match_ids = []

    for _ in range(total_matches):
        cursor = conn.execute(queries.MATCH_CREATE, (group_id,))
        match_id = cursor.fetchone()["id"]
        match_ids.append(match_id)

    # Link matches via bracket_matches
    # Matches are created in order: round 1 matches, then round 2, etc.
    # For a bracket of size 8: matches 0-3 are round 1, 4-5 are round 2, 6 is final
    matches_per_round = []
    round_size = bracket_size // 2

    idx = 0
    while round_size >= 1:
        round_matches = match_ids[idx:idx + round_size]
        matches_per_round.append(round_matches)
        idx += round_size
        round_size //= 2

    # Link matches to next round
    for round_idx in range(len(matches_per_round) - 1):
        current_round = matches_per_round[round_idx]
        next_round = matches_per_round[round_idx + 1]

        for i, match_id in enumerate(current_round):
            next_match_id = next_round[i // 2]
            conn.execute(queries.BRACKET_MATCH_CREATE, (match_id, next_match_id))

    # Final match has no next match
    final_match_id = matches_per_round[-1][0]
    conn.execute(queries.BRACKET_MATCH_CREATE, (final_match_id, None))

    # Assign teams to first round matches
    # Seeding: team 0 vs team bracket_size-1, team 1 vs team bracket_size-2, etc.
    first_round = matches_per_round[0]

    # Create seeding positions
    # Standard bracket seeding for single elimination
    def get_seed_positions(n: int) -> list[tuple[int, int]]:
        """Generate seed matchups for a bracket of size n (must be power of 2)."""
        if n == 1:
            return [(0, 1)]

        positions = []
        for i in range(n):
            seed1 = i
            seed2 = n * 2 - 1 - i
            positions.append((seed1, seed2))
        return positions

    seed_positions = get_seed_positions(len(first_round))

    for match_idx, (seed1, seed2) in enumerate(seed_positions):
        match_id = first_round[match_idx]

        # Add team for seed1 if within range
        if seed1 < n_teams:
            team_id = team_ids[seed1]
            conn.execute(queries.MATCH_TEAM_ADD, (match_id, team_id))

        # Add team for seed2 if within range (otherwise it's a bye)
        if seed2 < n_teams:
            team_id = team_ids[seed2]
            conn.execute(queries.MATCH_TEAM_ADD, (match_id, team_id))

    return match_ids


# =============================================================================
# App Setup
# =============================================================================

try:
    database.init_db(DATABASE_PATH, SCHEMA_PATH)
except Exception as e:
    logger.error(f"Failed to initialize database: {e}", exc_info=e)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# Stage Kinds Endpoint
# =============================================================================


# @app.get("/stage-kinds", response_model=list[StageKindResponse])
# def list_stage_kinds(conn=Depends(db_dependency)):
#     """List all available stage kinds for tournament creation."""
#     cursor = conn.execute(queries.STAGE_KINDS_LIST)
#     return [StageKindResponse(kind=row["kind"], label=row["label"]) for row in cursor.fetchall()]


@app.post("/log")
def log_frontend_error(log_request: FrontendLogRequest):
    """Log frontend errors to frontend.log file."""
    parts = [log_request.message]
    if log_request.url:
        parts.append(f"URL: {log_request.url}")
    if log_request.stack:
        parts.append(f"Stack: {log_request.stack}")
    if log_request.userAgent:
        parts.append(f"UserAgent: {log_request.userAgent}")

    log_message = " | ".join(parts)

    if log_request.level == "error":
        frontend_logger.error(log_message)
    elif log_request.level == "warn":
        frontend_logger.warning(log_message)
    else:
        frontend_logger.info(log_message)

    return {"status": "logged"}


# =============================================================================
# Olympiad Endpoints
# =============================================================================

@app.get("/foreign_keys_pragma", response_model=ForeignKeyPragmaResponse)
def foreign_keys_pragma():
    conn = database.get_connection(DATABASE_PATH)
    try:
        row = conn.execute("PRAGMA foreign_keys").fetchone()
    finally:
        conn.close()

    return ForeignKeyPragmaResponse(res=row[0])


@app.get("/olympiads", response_model=list[OlympiadIdNameVersion])
def olympiads_list():
    """List all olympiads."""

    conn = database.get_connection(DATABASE_PATH)
    try:
        rows = conn.execute(queries.olympiad_list).fetchall()
    finally:
        conn.close()

    return [
        OlympiadIdNameVersion(id=row["id"], name=row["name"], version=row["version"])
        for row in rows
    ]


# @app.get("/olympiads/{olympiad_id}", response_model=OlympiadDetail)
# def olympiad_get(olympiad_id: int, response: Response):
#     """Get full olympiad details including players, teams, and events."""
# 
#     conn = database.get_connection(DATABASE_PATH)
#     try:
#         conn.execute("BEGIN")
# 
#         cursor = conn.execute(queries.olympiad_get, (olympiad_id,))
#         olympiad = cursor.fetchone()
#         if not olympiad:
#             raise HTTPException(status_code=404, detail="Olympiad not found")
# 
#         cursor = conn.execute(queries.PLAYER_LIST, (olympiad_id,))
#         players = [PlayerResponse(id=row["id"], name=row["name"]) for row in cursor.fetchall()]
# 
#         cursor = conn.execute(queries.TEAM_LIST, (olympiad_id,))
#         teams = [TeamResponse(id=row["id"], name=row["name"]) for row in cursor.fetchall()]
# 
#         cursor = conn.execute(queries.EVENT_LIST, (olympiad_id,))
#         events = [
#             EventResponse(id=row["id"], name=row["name"], status=row["status"], score_kind=row["score_kind"])
#             for row in cursor.fetchall()
#         ]
# 
#         conn.commit()
# 
#         response.headers["ETag"] = f'"{olympiad["version"]}"'
#     finally:
#         conn.close()
# 
#     return OlympiadDetail(
#         id=olympiad["id"],
#         name=olympiad["name"],
#         version=olympiad["version"],
#         players=players,
#         teams=teams,
#         events=events,
#     )


@app.post("/olympiads", response_model=OlympiadIdName, status_code=201)
def olympiad_create(
    data: OlympiadName,
    response: Response,
    x_olympiad_pin: str = Header(..., alias="X-Olympiad-PIN")
):
    """Create a new olympiad with a provided or generated PIN."""

    conn = database.get_connection(DATABASE_PATH)
    try:
        assert len(x_olympiad_pin) == 4 and x_olympiad_pin.isdigit()
        row = conn.execute(queries.olympiad_create, (data.name, x_olympiad_pin)).fetchone()
        conn.commit()

        response.headers["ETag"] = f'"{row["version"]}"'
        response.headers["X-Olympiad-PIN"] = row["pin"]
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Olympiad with this name already exists")
    finally:
        conn.close()

    return OlympiadIdName(id=row["id"], name=row["name"])


@app.put("/olympiads/{olympiad_id}", response_model=OlympiadIdName)
def olympiad_update(
    olympiad_id: int,
    data: OlympiadName,
    response: Response,
    if_match: str = Header(..., alias="If-Match"),
    x_olympiad_pin: str = Header(..., alias="X-Olympiad-PIN")
):
    """Update olympiad name. Requires PIN in X-Olympiad-PIN header and If-Match for optimistic locking."""

    expected_version = int(if_match.strip('"'))

    conn = database.get_connection(DATABASE_PATH)
    try:
        conn.execute("BEGIN IMMEDIATE")

        row = conn.execute(queries.olympiad_get_internal, (olympiad_id,)).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Olimpiade non trovata")

        olympiad = OlympiadIdPinVersion(id=row["id"], pin=row["pin"], version=row["version"])

        if olympiad.pin != x_olympiad_pin:
            raise HTTPException(status_code=401, detail="PIN non valido")

        if olympiad.version != expected_version:
            raise HTTPException(status_code=412, detail="Questa olimpiade è già stata modificata da un altro admin")

        # All checks passed, do the update
        row = conn.execute(queries.olympiad_update, (data.name, olympiad_id, expected_version)).fetchone()
        updated_olympiad = OlympiadIdNameVersion(id=row["id"], name=row["name"], version=row["version"])

        conn.commit()
        response.headers["ETag"] = f'"{updated_olympiad.version}"'
    finally:
        conn.close()

    return OlympiadIdName(id=updated_olympiad.id, name=updated_olympiad.name)


@app.delete("/olympiads/{olympiad_id}", status_code=204)
def olympiad_delete(
    olympiad_id: int,
    if_match: str = Header(..., alias="If-Match"),
    x_olympiad_pin: str = Header(..., alias="X-Olympiad-PIN")
):
    """Delete an olympiad and all its data. Requires PIN in X-Olympiad-PIN header and If-Match for optimistic locking."""

    expected_version = int(if_match.strip('"'))

    conn = database.get_connection(DATABASE_PATH)
    try:
        conn.execute("BEGIN IMMEDIATE")

        row = conn.execute(queries.olympiad_get_internal, (olympiad_id,)).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Olimpiade non trovata")

        olympiad = OlympiadIdPinVersion(id=row["id"], pin=row["pin"], version=row["version"])

        if olympiad.pin != x_olympiad_pin:
            raise HTTPException(status_code=401, detail="PIN non valido")

        if olympiad.version != expected_version:
            raise HTTPException(status_code=412, detail="Questa olimpiade è già stata modificata da un altro admin")

        # All checks passed, do the delete
        conn.execute(queries.olympiad_delete, (olympiad_id,))

        conn.commit()
    finally:
        conn.close()


# =============================================================================
# Player Endpoints
# =============================================================================


@app.get("/olympiads/{olympiad_id}/players", response_model=list[PlayerIdNameVersion])
def players_list(olympiad_id: int):
    """List all players in an olympiad."""

    conn = database.get_connection(DATABASE_PATH)
    try:
        conn.execute("BEGIN")

        row = conn.execute(queries.olympiad_get, (olympiad_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Olimpiade non trovata")

        rows = conn.execute(queries.player_list, (olympiad_id,)).fetchall()
        players = [
            PlayerIdNameVersion(id=row["id"], name=row["name"], version=row["version"])
            for row in rows
        ]

        conn.commit()
    finally:
        conn.close()

    return players

@app.post("/olympiads/{olympiad_id}/players", response_model=PlayerIdName, status_code=201)
def player_create(
    olympiad_id: int,
    data: PlayerName,
    response: Response
):
    """Create a new player in an olympiad."""

    conn = database.get_connection(DATABASE_PATH)
    try:
        conn.execute("BEGIN IMMEDIATE")

        row = conn.execute(queries.olympiad_get, (olympiad_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Olimpiade non trovata")

        row = conn.execute(queries.player_create, (olympiad_id, data.name)).fetchone()
        player = PlayerIdNameVersion(id=row["id"], name=row["name"], version=row["version"])
        response.headers["ETag"] = f'"{player.version}"'

        conn.execute(queries.participant_create, (player.id,))

        conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Giocatore con questo nome già esistente")
    finally:
        conn.close()

    return PlayerIdName(id=player.id, name=player.name)

# 
# 
# @app.put("/olympiads/{olympiad_id}/players/{player_id}", response_model=PlayerResponse)
# def update_player(
#     olympiad_id: int,
#     player_id: int,
#     data: PlayerCreate,
#     if_match: Optional[str] = Header(None, alias="If-Match"),
#     conn=Depends(verified_olympiad)
# ):
#     """Update a player's name. Requires PIN in X-Olympiad-PIN header and If-Match for optimistic locking."""
#     if if_match is None:
#         raise HTTPException(status_code=428, detail="If-Match header is required")
# 
#     try:
#         version = int(if_match.strip('"'))
#     except ValueError:
#         raise HTTPException(status_code=400, detail="Invalid If-Match header format")
# 
#     cursor = conn.execute(queries.PLAYER_EXISTS, (player_id, olympiad_id))
#     if not cursor.fetchone():
#         return JSONResponse(status_code=404, content={"detail": "Player not found"})
# 
#     cursor = conn.execute(queries.PLAYER_UPDATE, (data.name, player_id, version))
#     row = cursor.fetchone()
#     if not row:
#         raise HTTPException(status_code=412, detail="Precondition Failed - resource has been modified")
# 
#     return PlayerResponse(id=row["id"], name=row["name"], version=row["version"])
# 
# 
# @app.delete("/olympiads/{olympiad_id}/players/{player_id}")
# def delete_player(olympiad_id: int, player_id: int, conn=Depends(verified_olympiad)):
#     """Delete a player from an olympiad. Requires PIN in X-Olympiad-PIN header."""
#     cursor = conn.execute(queries.PLAYER_EXISTS, (player_id, olympiad_id))
#     if not cursor.fetchone():
#         return JSONResponse(status_code=404, content={"detail": "Player not found"})
# 
#     conn.execute(queries.PLAYER_DELETE, (player_id,))
#     return {"message": "Player deleted"}
# 
# 
# # =============================================================================
# # Team Endpoints
# # =============================================================================
# 
# 
# @app.get("/olympiads/{olympiad_id}/teams", response_model=list[TeamResponse])
# def list_teams(olympiad_id: int, conn=Depends(db_dependency)):
#     """List all teams with more than one player in an olympiad."""
#     cursor = conn.execute(queries.OLYMPIAD_EXISTS, (olympiad_id,))
#     if not cursor.fetchone():
#         return JSONResponse(status_code=404, content={"detail": "Olympiad not found"})
# 
#     cursor = conn.execute(queries.TEAM_LIST, (olympiad_id,))
#     return [TeamResponse(id=row["id"], name=row["name"]) for row in cursor.fetchall()]
# 
# 
# @app.get("/olympiads/{olympiad_id}/teams/{team_id}", response_model=TeamDetail)
# def get_team(olympiad_id: int, team_id: int, conn=Depends(db_dependency)):
#     """Get team details including players."""
#     cursor = conn.execute(queries.TEAM_GET, (team_id, olympiad_id))
#     team = cursor.fetchone()
#     if not team:
#         return JSONResponse(status_code=404, content={"detail": "Team not found"})
# 
#     cursor = conn.execute(queries.TEAM_PLAYERS_LIST, (team_id,))
#     players = [PlayerResponse(id=row["id"], name=row["name"]) for row in cursor.fetchall()]
# 
#     return TeamDetail(id=team["id"], name=team["name"], players=players)
# 
# 
# @app.post("/olympiads/{olympiad_id}/teams", response_model=TeamResponse)
# def create_team(olympiad_id: int, data: TeamCreate, conn=Depends(verified_olympiad)):
#     """Create a new team in an olympiad. Requires PIN in X-Olympiad-PIN header."""
#     cursor = conn.execute(queries.TEAM_CREATE, (olympiad_id, data.name))
#     row = cursor.fetchone()
#     team_id = row["id"]
# 
#     for player_id in data.player_ids:
#         conn.execute(queries.TEAM_PLAYER_ADD, (team_id, player_id))
# 
#     return TeamResponse(id=team_id, name=row["name"])
# 
# 
# @app.put("/olympiads/{olympiad_id}/teams/{team_id}", response_model=TeamResponse)
# def update_team(olympiad_id: int, team_id: int, data: TeamCreate, conn=Depends(verified_olympiad)):
#     """Update a team's name and players. Requires PIN in X-Olympiad-PIN header."""
#     cursor = conn.execute(queries.TEAM_EXISTS, (team_id, olympiad_id))
#     if not cursor.fetchone():
#         return JSONResponse(status_code=404, content={"detail": "Team not found"})
# 
#     cursor = conn.execute(queries.TEAM_UPDATE, (data.name, team_id))
#     row = cursor.fetchone()
# 
#     conn.execute(queries.TEAM_PLAYERS_CLEAR, (team_id,))
#     for player_id in data.player_ids:
#         conn.execute(queries.TEAM_PLAYER_ADD, (team_id, player_id))
# 
#     return TeamResponse(id=row["id"], name=row["name"])
# 
# 
# @app.delete("/olympiads/{olympiad_id}/teams/{team_id}")
# def delete_team(olympiad_id: int, team_id: int, conn=Depends(verified_olympiad)):
#     """Delete a team from an olympiad. Requires PIN in X-Olympiad-PIN header."""
#     cursor = conn.execute(queries.TEAM_EXISTS, (team_id, olympiad_id))
#     if not cursor.fetchone():
#         return JSONResponse(status_code=404, content={"detail": "Team not found"})
# 
#     conn.execute(queries.TEAM_DELETE, (team_id,))
#     return {"message": "Team deleted"}
# 
# 
# # =============================================================================
# # Team Player Management
# # =============================================================================
# 
# 
# @app.post("/olympiads/{olympiad_id}/teams/{team_id}/players/{player_id}")
# def add_player_to_team(olympiad_id: int, team_id: int, player_id: int, conn=Depends(verified_olympiad)):
#     """Add a player to a team. Requires PIN in X-Olympiad-PIN header."""
#     cursor = conn.execute(queries.TEAM_EXISTS, (team_id, olympiad_id))
#     if not cursor.fetchone():
#         return JSONResponse(status_code=404, content={"detail": "Team not found"})
# 
#     cursor = conn.execute(queries.PLAYER_EXISTS, (player_id, olympiad_id))
#     if not cursor.fetchone():
#         return JSONResponse(status_code=404, content={"detail": "Player not found"})
# 
#     conn.execute(queries.TEAM_PLAYER_ADD, (team_id, player_id))
#     return {"message": "Player added to team"}
# 
# 
# @app.delete("/olympiads/{olympiad_id}/teams/{team_id}/players/{player_id}")
# def remove_player_from_team(olympiad_id: int, team_id: int, player_id: int, conn=Depends(verified_olympiad)):
#     """Remove a player from a team. Requires PIN in X-Olympiad-PIN header."""
#     cursor = conn.execute(queries.TEAM_EXISTS, (team_id, olympiad_id))
#     if not cursor.fetchone():
#         return JSONResponse(status_code=404, content={"detail": "Team not found"})
# 
#     cursor = conn.execute(queries.TEAM_PLAYER_EXISTS, (team_id, player_id))
#     if not cursor.fetchone():
#         return JSONResponse(status_code=404, content={"detail": "Player not in team"})
# 
#     conn.execute(queries.TEAM_PLAYER_REMOVE, (team_id, player_id))
#     return {"message": "Player removed from team"}
# 
# 
# # =============================================================================
# # Event Endpoints
# # =============================================================================
# 
# 
# @app.get("/olympiads/{olympiad_id}/events", response_model=list[EventResponse])
# def list_events(olympiad_id: int, conn=Depends(db_dependency)):
#     """List all events in an olympiad."""
#     cursor = conn.execute(queries.OLYMPIAD_EXISTS, (olympiad_id,))
#     if not cursor.fetchone():
#         return JSONResponse(status_code=404, content={"detail": "Olympiad not found"})
# 
#     cursor = conn.execute(queries.EVENT_LIST, (olympiad_id,))
#     return [
#         EventResponse(id=row["id"], name=row["name"], status=row["status"], score_kind=row["score_kind"])
#         for row in cursor.fetchall()
#     ]
# 
# 
# @app.get("/olympiads/{olympiad_id}/events/{event_id}", response_model=EventDetail)
# def get_event(olympiad_id: int, event_id: int, conn=Depends(db_dependency)):
#     """Get event details including enrolled teams."""
#     cursor = conn.execute(queries.EVENT_GET, (event_id, olympiad_id))
#     event = cursor.fetchone()
#     if not event:
#         return JSONResponse(status_code=404, content={"detail": "Event not found"})
# 
#     cursor = conn.execute(queries.EVENT_TEAMS_LIST, (event_id,))
#     teams = [TeamResponse(id=row["id"], name=row["name"]) for row in cursor.fetchall()]
# 
#     return EventDetail(
#         id=event["id"],
#         name=event["name"],
#         status=event["status"],
#         score_kind=event["score_kind"],
#         teams=teams,
#     )
# 
# 
# @app.post("/olympiads/{olympiad_id}/events", response_model=EventResponse)
# def create_event(olympiad_id: int, data: EventCreate, conn=Depends(verified_olympiad)):
#     """Create a new event in an olympiad. Requires PIN in X-Olympiad-PIN header."""
#     if data.score_kind not in ("points", "outcome"):
#         return JSONResponse(status_code=400, content={"detail": "score_kind must be 'points' or 'outcome'"})
# 
#     cursor = conn.execute(queries.EVENT_CREATE, (olympiad_id, data.name, data.score_kind))
#     row = cursor.fetchone()
#     return EventResponse(
#         id=row["id"], name=row["name"], status=row["status"], score_kind=row["score_kind"]
#     )
# 
# 
# @app.put("/olympiads/{olympiad_id}/events/{event_id}", response_model=EventResponse)
# def update_event(olympiad_id: int, event_id: int, data: EventUpdate, conn=Depends(verified_olympiad)):
#     """Update an event's name or status. Requires PIN in X-Olympiad-PIN header."""
#     cursor = conn.execute(queries.EVENT_GET, (event_id, olympiad_id))
#     event = cursor.fetchone()
#     if not event:
#         return JSONResponse(status_code=404, content={"detail": "Event not found"})
# 
#     new_name = data.name if data.name is not None else event["name"]
#     new_status = data.status if data.status is not None else event["status"]
# 
#     if new_status not in ("registration", "started", "finished"):
#         return JSONResponse(status_code=400, content={"detail": "Invalid status"})
# 
#     cursor = conn.execute(queries.EVENT_UPDATE, (new_name, new_status, event_id))
#     row = cursor.fetchone()
#     return EventResponse(
#         id=row["id"], name=row["name"], status=row["status"], score_kind=row["score_kind"]
#     )
# 
# 
# @app.delete("/olympiads/{olympiad_id}/events/{event_id}")
# def delete_event(olympiad_id: int, event_id: int, conn=Depends(verified_olympiad)):
#     """Delete an event. Requires PIN in X-Olympiad-PIN header."""
#     cursor = conn.execute(queries.EVENT_EXISTS, (event_id, olympiad_id))
#     if not cursor.fetchone():
#         return JSONResponse(status_code=404, content={"detail": "Event not found"})
# 
#     conn.execute(queries.EVENT_DELETE, (event_id,))
#     return {"message": "Event deleted"}
# 
# 
# # =============================================================================
# # Event Team Enrollment
# # =============================================================================
# 
# 
# class TeamEnrollment(BaseModel):
#     seed: Optional[int] = None
# 
# 
# @app.post("/olympiads/{olympiad_id}/events/{event_id}/teams/{team_id}")
# def enroll_team(
#     olympiad_id: int,
#     event_id: int,
#     team_id: int,
#     data: TeamEnrollment = TeamEnrollment(),
#     conn=Depends(verified_olympiad)
# ):
#     """Enroll a team in an event. Requires PIN in X-Olympiad-PIN header."""
#     cursor = conn.execute(queries.EVENT_EXISTS, (event_id, olympiad_id))
#     if not cursor.fetchone():
#         return JSONResponse(status_code=404, content={"detail": "Event not found"})
# 
#     cursor = conn.execute(queries.TEAM_EXISTS, (team_id, olympiad_id))
#     if not cursor.fetchone():
#         return JSONResponse(status_code=404, content={"detail": "Team not found"})
# 
#     conn.execute(queries.EVENT_TEAM_ENROLL, (event_id, team_id, data.seed))
#     return {"message": "Team enrolled"}
# 
# 
# @app.put("/olympiads/{olympiad_id}/events/{event_id}/teams/{team_id}")
# def update_team_enrollment(
#     olympiad_id: int,
#     event_id: int,
#     team_id: int,
#     data: TeamEnrollment,
#     conn=Depends(verified_olympiad)
# ):
#     """Update a team's seed in an event. Requires PIN in X-Olympiad-PIN header."""
#     _ = olympiad_id  # Used by verified_olympiad dependency
#     cursor = conn.execute(queries.EVENT_TEAM_EXISTS, (event_id, team_id))
#     if not cursor.fetchone():
#         return JSONResponse(status_code=404, content={"detail": "Team not enrolled in event"})
# 
#     conn.execute(queries.EVENT_TEAM_UPDATE, (data.seed, event_id, team_id))
#     return {"message": "Team enrollment updated"}
# 
# 
# @app.delete("/olympiads/{olympiad_id}/events/{event_id}/teams/{team_id}")
# def unenroll_team(olympiad_id: int, event_id: int, team_id: int, conn=Depends(verified_olympiad)):
#     """Remove a team from an event. Requires PIN in X-Olympiad-PIN header."""
#     _ = olympiad_id  # Used by verified_olympiad dependency
#     cursor = conn.execute(queries.EVENT_TEAM_EXISTS, (event_id, team_id))
#     if not cursor.fetchone():
#         return JSONResponse(status_code=404, content={"detail": "Team not enrolled in event"})
# 
#     conn.execute(queries.EVENT_TEAM_REMOVE, (event_id, team_id))
#     return {"message": "Team unenrolled"}
# 
# 
# # =============================================================================
# # Event with Stages (Tournament Creation)
# # =============================================================================
# 
# 
# @app.post("/olympiads/{olympiad_id}/events/with-stages", response_model=EventDetailWithBracket)
# def create_event_with_stages(olympiad_id: int, data: EventCreateWithStages, conn=Depends(verified_olympiad)):
#     """
#     Create a new event with stages and teams.
#     Sets up tournament brackets for single elimination stages.
#     Requires PIN in X-Olympiad-PIN header.
#     """
#     if data.score_kind not in ("points", "outcome"):
#         return JSONResponse(status_code=400, content={"detail": "score_kind must be 'points' or 'outcome'"})
# 
#     if not data.stages:
#         return JSONResponse(status_code=400, content={"detail": "At least one stage is required"})
# 
#     if len(data.team_ids) < 2:
#         return JSONResponse(status_code=400, content={"detail": "At least 2 teams are required"})
# 
#     # Validate all teams exist
#     for team_id in data.team_ids:
#         cursor = conn.execute(queries.TEAM_EXISTS, (team_id, olympiad_id))
#         if not cursor.fetchone():
#             return JSONResponse(status_code=404, content={"detail": f"Team {team_id} not found"})
# 
#     # Get valid stage kinds
#     cursor = conn.execute(queries.STAGE_KINDS_LIST)
#     valid_kinds = [row["kind"] for row in cursor.fetchall()]
# 
#     # Validate stage kinds before creating anything
#     for stage_config in data.stages:
#         if stage_config.kind not in valid_kinds:
#             return JSONResponse(status_code=400, content={"detail": f"Invalid stage kind: {stage_config.kind}"})
# 
#     # Create event
#     cursor = conn.execute(queries.EVENT_CREATE, (olympiad_id, data.name, data.score_kind))
#     event_row = cursor.fetchone()
#     event_id = event_row["id"]
# 
#     # Enroll all teams in the event
#     for idx, team_id in enumerate(data.team_ids):
#         conn.execute(queries.EVENT_TEAM_ENROLL, (event_id, team_id, idx))
# 
#     stages_response = []
# 
#     # Create stages
#     for stage_order, stage_config in enumerate(data.stages):
#         # Create the stage
#         cursor = conn.execute(queries.STAGE_CREATE, (
#             event_id,
#             stage_config.kind,
#             stage_order,
#             stage_config.advance_count
#         ))
#         stage_id = cursor.fetchone()["id"]
# 
#         # Create a group for the stage
#         cursor = conn.execute(queries.GROUP_CREATE, (stage_id,))
#         group_id = cursor.fetchone()["id"]
# 
#         # Add teams to group
#         for team_id in data.team_ids:
#             conn.execute(queries.GROUP_TEAM_ADD, (group_id, team_id))
# 
#         matches_response = []
# 
#         # Create bracket structure for single elimination
#         if stage_config.kind == "single_elimination":
#             match_ids = create_single_elimination_bracket(conn, stage_id, group_id, data.team_ids)
# 
#             # Get match details for response
#             for match_id in match_ids:
#                 cursor = conn.execute(queries.MATCH_GET, (match_id,))
#                 match_row = cursor.fetchone()
# 
#                 cursor = conn.execute(queries.BRACKET_MATCH_GET, (match_id,))
#                 bracket_row = cursor.fetchone()
# 
#                 cursor = conn.execute(queries.MATCH_TEAMS_LIST, (match_id,))
#                 match_teams = []
#                 for team_row in cursor.fetchall():
#                     match_teams.append(MatchTeamResponse(
#                         id=team_row["id"],
#                         name=team_row["name"],
#                         score=None
#                     ))
# 
#                 matches_response.append(MatchResponse(
#                     id=match_id,
#                     status=match_row["status"],
#                     teams=match_teams,
#                     next_match_id=bracket_row["next_match_id"] if bracket_row else None
#                 ))
# 
#         stages_response.append(StageResponse(
#             id=stage_id,
#             kind=stage_config.kind,
#             status="pending",
#             stage_order=stage_order,
#             advance_count=stage_config.advance_count,
#             matches=matches_response
#         ))
# 
#     # Get enrolled teams
#     cursor = conn.execute(queries.EVENT_TEAMS_LIST, (event_id,))
#     teams = [TeamResponse(id=row["id"], name=row["name"]) for row in cursor.fetchall()]
# 
#     return EventDetailWithBracket(
#         id=event_id,
#         name=event_row["name"],
#         status=event_row["status"],
#         score_kind=event_row["score_kind"],
#         teams=teams,
#         stages=stages_response
#     )
# 
# 
# @app.get("/olympiads/{olympiad_id}/events/{event_id}/bracket", response_model=EventDetailWithBracket)
# def get_event_with_bracket(olympiad_id: int, event_id: int, conn=Depends(db_dependency)):
#     """Get event details including stages and bracket structure."""
#     cursor = conn.execute(queries.EVENT_GET, (event_id, olympiad_id))
#     event = cursor.fetchone()
#     if not event:
#         return JSONResponse(status_code=404, content={"detail": "Event not found"})
# 
#     # Get enrolled teams
#     cursor = conn.execute(queries.EVENT_TEAMS_LIST, (event_id,))
#     teams = [TeamResponse(id=row["id"], name=row["name"]) for row in cursor.fetchall()]
# 
#     # Get stages
#     cursor = conn.execute(queries.STAGE_LIST, (event_id,))
#     stages_response = []
# 
#     for stage_row in cursor.fetchall():
#         stage_id = stage_row["id"]
# 
#         # Get groups for stage
#         cursor2 = conn.execute(queries.GROUP_LIST, (stage_id,))
#         groups = cursor2.fetchall()
# 
#         matches_response = []
#         for group_row in groups:
#             group_id = group_row["id"]
# 
#             # Get matches in group
#             cursor3 = conn.execute(queries.MATCH_LIST, (group_id,))
#             for match_row in cursor3.fetchall():
#                 match_id = match_row["id"]
# 
#                 # Get bracket info
#                 cursor4 = conn.execute(queries.BRACKET_MATCH_GET, (match_id,))
#                 bracket_row = cursor4.fetchone()
# 
#                 # Get teams in match
#                 cursor5 = conn.execute(queries.MATCH_TEAMS_LIST, (match_id,))
#                 match_teams = []
#                 for team_row in cursor5.fetchall():
#                     # Get score if exists
#                     cursor6 = conn.execute(queries.MATCH_SCORES_GET, (match_id,))
#                     scores = {s["team_id"]: s["score"] for s in cursor6.fetchall()}
# 
#                     match_teams.append(MatchTeamResponse(
#                         id=team_row["id"],
#                         name=team_row["name"],
#                         score=scores.get(team_row["id"])
#                     ))
# 
#                 matches_response.append(MatchResponse(
#                     id=match_id,
#                     status=match_row["status"],
#                     teams=match_teams,
#                     next_match_id=bracket_row["next_match_id"] if bracket_row else None
#                 ))
# 
#         stages_response.append(StageResponse(
#             id=stage_id,
#             kind=stage_row["kind"],
#             status=stage_row["status"],
#             stage_order=stage_row["stage_order"],
#             advance_count=stage_row["advance_count"],
#             matches=matches_response
#         ))
# 
#     return EventDetailWithBracket(
#         id=event["id"],
#         name=event["name"],
#         status=event["status"],
#         score_kind=event["score_kind"],
#         teams=teams,
#         stages=stages_response
#     )

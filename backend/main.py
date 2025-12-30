import random
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import Session, col, select

from database import create_db_and_tables, engine, get_session
from models import (
    Olympiad,
    Player,
    Tournament,
    TournamentPlayer,
    TournamentStatus,
    TournamentType,
)


# =============================================================================
# Pydantic Schemas
# =============================================================================


# Olympiad schemas
class OlympiadCreate(BaseModel):
    name: str


class OlympiadSummary(BaseModel):
    name: str
    version: int


class OlympiadUpdate(BaseModel):
    name: str
    version: int


class OlympiadResponse(BaseModel):
    id: int
    name: str
    pin: str
    version: int


class OlympiadDetail(BaseModel):
    id: int
    name: str
    pin: str
    version: int
    players: list["PlayerResponse"]
    tournaments: list["TournamentResponse"]


# Player schemas
class PlayerCreate(BaseModel):
    name: str


class PlayerUpdate(BaseModel):
    name: str
    version: int


class PlayerResponse(BaseModel):
    id: int
    name: str
    version: int


# Tournament schemas
class TournamentCreate(BaseModel):
    name: str
    type: TournamentType


class TournamentUpdate(BaseModel):
    name: str | None = None
    status: TournamentStatus | None = None
    version: int


class TournamentResponse(BaseModel):
    id: int
    name: str
    type: TournamentType
    status: TournamentStatus
    version: int


class TournamentDetail(BaseModel):
    id: int
    name: str
    type: TournamentType
    status: TournamentStatus
    version: int
    players: list[PlayerResponse]


# =============================================================================
# Helper Functions
# =============================================================================


def generate_pin() -> str:
    return f"{random.randint(0, 9999):04d}"


def get_olympiad_by_name(session: Session, name: str) -> Olympiad:
    olympiad = session.exec(select(Olympiad).where(Olympiad.name == name)).first()
    if not olympiad:
        raise HTTPException(status_code=404, detail="Olympiad not found")
    return olympiad


def check_version(entity: Olympiad | Player | Tournament, provided_version: int, entity_name: str):
    if entity.version != provided_version:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "conflict",
                "message": f"{entity_name} was modified by another user",
                "current_version": entity.version,
            },
        )


# =============================================================================
# Seed Mock Data
# =============================================================================


def seed_mock_data():
    """Seed the database with mock data if empty."""
    with Session(engine) as session:
        existing = session.exec(select(Olympiad)).first()
        if existing:
            return

        # Create olympiads
        olympiad1 = Olympiad(name="Enniolimpiadi2025", pin="1234")
        olympiad2 = Olympiad(name="Enniolimpiadi2026", pin="5678")
        session.add(olympiad1)
        session.add(olympiad2)
        session.commit()
        session.refresh(olympiad1)
        session.refresh(olympiad2)

        # Create players for olympiad1
        player_names = ["Marco", "Luca", "Giulia", "Sara", "Andrea", "Francesca"]
        players = []
        for name in player_names:
            player = Player(olympiad_id=olympiad1.id, name=name)
            session.add(player)
            players.append(player)
        session.commit()
        for p in players:
            session.refresh(p)

        # Create tournaments for olympiad1
        ping_pong = Tournament(
            olympiad_id=olympiad1.id,
            name="Ping Pong",
            type=TournamentType.SINGLE_ELIMINATION,
            status=TournamentStatus.IN_PROGRESS,
        )
        machiavelli = Tournament(
            olympiad_id=olympiad1.id,
            name="Machiavelli",
            type=TournamentType.ROUND_ROBIN,
            status=TournamentStatus.PENDING,
        )
        scopone = Tournament(
            olympiad_id=olympiad1.id,
            name="Scopone",
            type=TournamentType.ROUND_ROBIN,
            status=TournamentStatus.PENDING,
        )
        session.add(ping_pong)
        session.add(machiavelli)
        session.add(scopone)
        session.commit()
        session.refresh(ping_pong)
        session.refresh(machiavelli)
        session.refresh(scopone)

        # Enroll players in tournaments
        for player in players[:4]:
            session.add(
                TournamentPlayer(tournament_id=ping_pong.id, player_id=player.id)
            )
        for player in players:
            session.add(
                TournamentPlayer(tournament_id=machiavelli.id, player_id=player.id)
            )
        for player in [players[0], players[1], players[4], players[5]]:
            session.add(
                TournamentPlayer(tournament_id=scopone.id, player_id=player.id)
            )
        session.commit()

        print("Mock data seeded successfully!")


# =============================================================================
# App Setup
# =============================================================================


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    seed_mock_data()
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


@app.get("/olympiads", response_model=list[OlympiadSummary])
def list_olympiads(session: Session = Depends(get_session)):
    """List all olympiads with name and version."""
    olympiads = session.exec(select(Olympiad)).all()
    return [OlympiadSummary(name=o.name, version=o.version) for o in olympiads]


@app.get("/olympiads/{name}", response_model=OlympiadDetail)
def get_olympiad(name: str, session: Session = Depends(get_session)):
    """Get full olympiad details including players and tournaments."""
    olympiad = get_olympiad_by_name(session, name)
    players = session.exec(select(Player).where(Player.olympiad_id == olympiad.id)).all()
    tournaments = session.exec(select(Tournament).where(Tournament.olympiad_id == olympiad.id)).all()
    return OlympiadDetail(
        id=olympiad.id,
        name=olympiad.name,
        pin=olympiad.pin,
        version=olympiad.version,
        players=[PlayerResponse(id=p.id, name=p.name, version=p.version) for p in players],
        tournaments=[
            TournamentResponse(
                id=t.id, name=t.name, type=t.type, status=t.status, version=t.version
            )
            for t in tournaments
        ],
    )


@app.post("/olympiads", response_model=OlympiadResponse)
def create_olympiad(data: OlympiadCreate, session: Session = Depends(get_session)):
    """Create a new olympiad."""
    existing = session.exec(select(Olympiad).where(Olympiad.name == data.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Olympiad name already exists")

    olympiad = Olympiad(name=data.name, pin=generate_pin())
    session.add(olympiad)
    session.commit()
    session.refresh(olympiad)
    return OlympiadResponse(
        id=olympiad.id, name=olympiad.name, pin=olympiad.pin, version=olympiad.version
    )


@app.put("/olympiads/{name}", response_model=OlympiadResponse)
def update_olympiad(
    name: str, data: OlympiadUpdate, session: Session = Depends(get_session)
):
    """Update olympiad name (with optimistic locking)."""
    olympiad = get_olympiad_by_name(session, name)
    check_version(olympiad, data.version, "Olympiad")

    # Check new name doesn't conflict
    if data.name != olympiad.name:
        existing = session.exec(
            select(Olympiad).where(Olympiad.name == data.name)
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Olympiad name already exists")

    olympiad.name = data.name
    olympiad.version += 1
    olympiad.updated_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(olympiad)
    return OlympiadResponse(
        id=olympiad.id, name=olympiad.name, pin=olympiad.pin, version=olympiad.version
    )


@app.delete("/olympiads/{name}")
def delete_olympiad(
    name: str, session: Session = Depends(get_session)
):
    """Delete an olympiad and all its data."""
    olympiad = get_olympiad_by_name(session, name)
    session.delete(olympiad)
    session.commit()
    return {"message": "Olympiad deleted"}


# =============================================================================
# Player Endpoints
# =============================================================================


@app.get("/olympiads/{name}/players", response_model=list[PlayerResponse])
def list_players(name: str, session: Session = Depends(get_session)):
    """List all players in an olympiad."""
    olympiad = get_olympiad_by_name(session, name)
    players = session.exec(select(Player).where(Player.olympiad_id == olympiad.id)).all()
    return [
        PlayerResponse(id=p.id, name=p.name, version=p.version)
        for p in players
    ]


@app.post("/olympiads/{name}/players", response_model=PlayerResponse)
def create_player(
    name: str, data: PlayerCreate, session: Session = Depends(get_session)
):
    """Create a new player in an olympiad."""
    olympiad = get_olympiad_by_name(session, name)

    # Check for duplicate name
    existing = session.exec(
        select(Player).where(
            Player.olympiad_id == olympiad.id, Player.name == data.name
        )
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Player name already exists")

    player = Player(olympiad_id=olympiad.id, name=data.name)
    session.add(player)
    session.commit()
    session.refresh(player)
    return PlayerResponse(id=player.id, name=player.name, version=player.version)


@app.put("/olympiads/{name}/players/{player_id}", response_model=PlayerResponse)
def update_player(
    name: str, player_id: int, data: PlayerUpdate, session: Session = Depends(get_session)
):
    """Update a player (with optimistic locking)."""
    olympiad = get_olympiad_by_name(session, name)
    player = session.get(Player, player_id)
    if not player or player.olympiad_id != olympiad.id:
        raise HTTPException(status_code=404, detail="Player not found")

    check_version(player, data.version, "Player")

    # Check new name doesn't conflict
    if data.name != player.name:
        existing = session.exec(
            select(Player).where(
                Player.olympiad_id == olympiad.id, Player.name == data.name
            )
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Player name already exists")

    player.name = data.name
    player.version += 1
    player.updated_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(player)
    return PlayerResponse(id=player.id, name=player.name, version=player.version)


@app.delete("/olympiads/{name}/players/{player_id}")
def delete_player(
    name: str, player_id: int, session: Session = Depends(get_session)
):
    """Delete a player from an olympiad."""
    olympiad = get_olympiad_by_name(session, name)
    player = session.get(Player, player_id)
    if not player or player.olympiad_id != olympiad.id:
        raise HTTPException(status_code=404, detail="Player not found")

    session.delete(player)
    session.commit()
    return {"message": "Player deleted"}


# =============================================================================
# Tournament Endpoints
# =============================================================================


@app.get("/olympiads/{name}/tournaments", response_model=list[TournamentResponse])
def list_tournaments(name: str, session: Session = Depends(get_session)):
    """List all tournaments in an olympiad."""
    olympiad = get_olympiad_by_name(session, name)
    tournaments = session.exec(select(Tournament).where(Tournament.olympiad_id == olympiad.id)).all()
    return [
        TournamentResponse(
            id=t.id, name=t.name, type=t.type, status=t.status, version=t.version
        )
        for t in tournaments
    ]


@app.get("/olympiads/{name}/tournaments/{tournament_id}", response_model=TournamentDetail)
def get_tournament(
    name: str, tournament_id: int, session: Session = Depends(get_session)
):
    """Get tournament details including enrolled players."""
    olympiad = get_olympiad_by_name(session, name)
    tournament = session.get(Tournament, tournament_id)
    if not tournament or tournament.olympiad_id != olympiad.id:
        raise HTTPException(status_code=404, detail="Tournament not found")

    # Get enrolled players through link table
    players = session.exec(
        select(Player)
        .join(TournamentPlayer, col(Player.id) == col(TournamentPlayer.player_id))
        .where(TournamentPlayer.tournament_id == tournament_id)
    ).all()

    return TournamentDetail(
        id=tournament.id,
        name=tournament.name,
        type=tournament.type,
        status=tournament.status,
        version=tournament.version,
        players=[
            PlayerResponse(id=p.id, name=p.name, version=p.version)
            for p in players
        ],
    )


@app.post("/olympiads/{name}/tournaments", response_model=TournamentResponse)
def create_tournament(
    name: str, data: TournamentCreate, session: Session = Depends(get_session)
):
    """Create a new tournament in an olympiad."""
    olympiad = get_olympiad_by_name(session, name)

    # Check for duplicate name
    existing = session.exec(
        select(Tournament).where(
            Tournament.olympiad_id == olympiad.id, Tournament.name == data.name
        )
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tournament name already exists")

    tournament = Tournament(olympiad_id=olympiad.id, name=data.name, type=data.type)
    session.add(tournament)
    session.commit()
    session.refresh(tournament)
    return TournamentResponse(
        id=tournament.id,
        name=tournament.name,
        type=tournament.type,
        status=tournament.status,
        version=tournament.version,
    )


@app.put("/olympiads/{name}/tournaments/{tournament_id}", response_model=TournamentResponse)
def update_tournament(
    name: str,
    tournament_id: int,
    data: TournamentUpdate,
    session: Session = Depends(get_session),
):
    """Update a tournament (with optimistic locking)."""
    olympiad = get_olympiad_by_name(session, name)
    tournament = session.get(Tournament, tournament_id)
    if not tournament or tournament.olympiad_id != olympiad.id:
        raise HTTPException(status_code=404, detail="Tournament not found")

    check_version(tournament, data.version, "Tournament")

    if data.name is not None and data.name != tournament.name:
        existing = session.exec(
            select(Tournament).where(
                Tournament.olympiad_id == olympiad.id, Tournament.name == data.name
            )
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Tournament name already exists")
        tournament.name = data.name

    if data.status is not None:
        tournament.status = data.status

    tournament.version += 1
    tournament.updated_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(tournament)
    return TournamentResponse(
        id=tournament.id,
        name=tournament.name,
        type=tournament.type,
        status=tournament.status,
        version=tournament.version,
    )


@app.delete("/olympiads/{name}/tournaments/{tournament_id}")
def delete_tournament(
    name: str, tournament_id: int, session: Session = Depends(get_session)
):
    """Delete a tournament."""
    olympiad = get_olympiad_by_name(session, name)
    tournament = session.get(Tournament, tournament_id)
    if not tournament or tournament.olympiad_id != olympiad.id:
        raise HTTPException(status_code=404, detail="Tournament not found")

    session.delete(tournament)
    session.commit()
    return {"message": "Tournament deleted"}


# =============================================================================
# Tournament Player Enrollment
# =============================================================================


@app.post("/olympiads/{name}/tournaments/{tournament_id}/players/{player_id}")
def enroll_player(
    name: str, tournament_id: int, player_id: int, session: Session = Depends(get_session)
):
    """Enroll a player in a tournament."""
    olympiad = get_olympiad_by_name(session, name)

    tournament = session.get(Tournament, tournament_id)
    if not tournament or tournament.olympiad_id != olympiad.id:
        raise HTTPException(status_code=404, detail="Tournament not found")

    player = session.get(Player, player_id)
    if not player or player.olympiad_id != olympiad.id:
        raise HTTPException(status_code=404, detail="Player not found")

    # Check if already enrolled
    existing = session.exec(
        select(TournamentPlayer).where(
            TournamentPlayer.tournament_id == tournament_id,
            TournamentPlayer.player_id == player_id,
        )
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Player already enrolled")

    enrollment = TournamentPlayer(tournament_id=tournament_id, player_id=player_id)
    session.add(enrollment)
    session.commit()
    return {"message": "Player enrolled"}


@app.delete("/olympiads/{name}/tournaments/{tournament_id}/players/{player_id}")
def unenroll_player(
    name: str, tournament_id: int, player_id: int, session: Session = Depends(get_session)
):
    """Remove a player from a tournament."""
    olympiad = get_olympiad_by_name(session, name)

    tournament = session.get(Tournament, tournament_id)
    if not tournament or tournament.olympiad_id != olympiad.id:
        raise HTTPException(status_code=404, detail="Tournament not found")

    enrollment = session.exec(
        select(TournamentPlayer).where(
            TournamentPlayer.tournament_id == tournament_id,
            TournamentPlayer.player_id == player_id,
        )
    ).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Player not enrolled")

    session.delete(enrollment)
    session.commit()
    return {"message": "Player unenrolled"}

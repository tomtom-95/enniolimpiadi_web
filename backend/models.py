from datetime import datetime, timezone
from enum import Enum

from sqlmodel import Field, SQLModel


class TournamentType(str, Enum):
    ROUND_ROBIN = "round_robin"
    SINGLE_ELIMINATION = "single_elimination"
    DOUBLE_ELIMINATION = "double_elimination"


class TournamentStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class Olympiad(SQLModel, table=True):
    __tablename__ = "olympiads"  # type: ignore[assignment]

    id: int = Field(default=None, primary_key=True)  # type: ignore[assignment]
    name: str = Field(unique=True, index=True)
    pin: str
    version: int = Field(default=1)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Link table for many-to-many: Tournament <-> Player
class TournamentPlayer(SQLModel, table=True):
    __tablename__ = "tournament_players"  # type: ignore[assignment]

    tournament_id: int = Field(foreign_key="tournaments.id", primary_key=True, ondelete="CASCADE")
    player_id: int = Field(foreign_key="players.id", primary_key=True, ondelete="CASCADE")


class Player(SQLModel, table=True):
    __tablename__ = "players"  # type: ignore[assignment]

    id: int = Field(default=None, primary_key=True)  # type: ignore[assignment]
    olympiad_id: int = Field(foreign_key="olympiads.id", ondelete="CASCADE")
    name: str
    version: int = Field(default=1)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Tournament(SQLModel, table=True):
    __tablename__ = "tournaments"  # type: ignore[assignment]

    id: int = Field(default=None, primary_key=True)  # type: ignore[assignment]
    olympiad_id: int = Field(foreign_key="olympiads.id", ondelete="CASCADE")
    name: str
    type: TournamentType
    status: TournamentStatus = Field(default=TournamentStatus.PENDING)
    version: int = Field(default=1)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
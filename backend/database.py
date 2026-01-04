import sqlite3
from pathlib import Path
from contextlib import contextmanager

DATABASE_PATH = Path(__file__).parent / "olympiad.db"
SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def get_connection() -> sqlite3.Connection:
    """Create a new database connection with foreign keys enabled."""
    # conn = sqlite3.connect(DATABASE_PATH, check_same_thread=False)
    conn = sqlite3.connect("wrong/path/olympiad.db", check_same_thread=False)
    conn.row_factory = sqlite3.Row  # Access columns by name
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def get_db():
    """Context manager for database connections."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Initialize the database by executing the schema."""
    with open(SCHEMA_PATH, "r") as f:
        schema = f.read()

    conn = get_connection()
    try:
        conn.executescript(schema)
        conn.commit()
    finally:
        conn.close()


def purge_db():
    """Delete the database file."""
    if DATABASE_PATH.exists():
        DATABASE_PATH.unlink()

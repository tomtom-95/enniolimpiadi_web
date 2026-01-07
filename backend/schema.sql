-- Schema for Enniolimpiadi
-- Generated from db_design.dbml

PRAGMA foreign_keys = ON;

-- =====================
-- CORE TABLES
-- =====================

CREATE TABLE IF NOT EXISTS olympiads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    pin TEXT NOT NULL CHECK (length(pin) = 4),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    olympiad_id INTEGER NOT NULL REFERENCES olympiads(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'registration' CHECK (status IN ('registration', 'started', 'finished')),
    score_kind TEXT NOT NULL CHECK (score_kind IN ('points', 'outcome')),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (olympiad_id, name)
);

CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    olympiad_id INTEGER NOT NULL REFERENCES olympiads(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (olympiad_id, name)
);

CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    olympiad_id INTEGER NOT NULL REFERENCES olympiads(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (olympiad_id, name)
);

CREATE TABLE IF NOT EXISTS team_players (
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (team_id, player_id)
);

CREATE TABLE IF NOT EXISTS event_teams (
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    seed INTEGER,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id, team_id)
);

-- =====================
-- TOURNAMENT STRUCTURE
-- =====================

CREATE TABLE IF NOT EXISTS stage_kinds (
    kind TEXT PRIMARY KEY,
    label TEXT NOT NULL
);

INSERT OR IGNORE INTO stage_kinds (kind, label) VALUES
    ('groups', 'Gironi'),
    ('round_robin', 'Girone all''italiana'),
    ('single_elimination', 'Eliminazione diretta');

CREATE TABLE IF NOT EXISTS event_stages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    kind TEXT NOT NULL REFERENCES stage_kinds(kind),
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'finished')),
    stage_order INTEGER NOT NULL,
    advance_count INTEGER,  -- null for final stage
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (event_id, stage_order)
);

CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_stage_id INTEGER NOT NULL REFERENCES event_stages(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS group_teams (
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, team_id)
);

-- =====================
-- MATCHES
-- =====================

CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'finished')),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- NOTE: round and position are computed in the application layer
CREATE TABLE IF NOT EXISTS bracket_matches (
    match_id INTEGER PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
    next_match_id INTEGER REFERENCES matches(id) ON DELETE SET NULL,  -- null for final match
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================
-- MATCH PARTICIPATION
-- =====================

CREATE TABLE IF NOT EXISTS match_teams (
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (match_id, team_id)
);

CREATE TABLE IF NOT EXISTS match_team_scores (
    match_id INTEGER NOT NULL,
    team_id INTEGER NOT NULL,
    score INTEGER NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (match_id, team_id),
    FOREIGN KEY (match_id, team_id) REFERENCES match_teams(match_id, team_id) ON DELETE CASCADE
);

-- =====================
-- INDEXES FOR PERFORMANCE
-- =====================

CREATE INDEX IF NOT EXISTS idx_events_olympiad ON events(olympiad_id);
CREATE INDEX IF NOT EXISTS idx_players_olympiad ON players(olympiad_id);
CREATE INDEX IF NOT EXISTS idx_teams_olympiad ON teams(olympiad_id);
CREATE INDEX IF NOT EXISTS idx_event_stages_event ON event_stages(event_id);
CREATE INDEX IF NOT EXISTS idx_groups_stage ON groups(event_stage_id);
CREATE INDEX IF NOT EXISTS idx_matches_group ON matches(group_id);

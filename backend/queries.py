# =============================================================================
# Olympiad Queries
# =============================================================================

OLYMPIAD_LIST = "SELECT id, name FROM olympiads ORDER BY id"

OLYMPIAD_GET = "SELECT id, name FROM olympiads WHERE id = ?"

OLYMPIAD_EXISTS = "SELECT id FROM olympiads WHERE id = ?"

OLYMPIAD_CREATE = "INSERT INTO olympiads (name, pin) VALUES (?, ?) RETURNING id, name, pin"

OLYMPIAD_VERIFY_PIN = "SELECT id FROM olympiads WHERE id = ? AND pin = ?"

OLYMPIAD_UPDATE = """
UPDATE olympiads SET name = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ? RETURNING id, name
"""

OLYMPIAD_DELETE = "DELETE FROM olympiads WHERE id = ?"


# =============================================================================
# Player Queries
# =============================================================================

PLAYER_LIST = "SELECT id, name FROM players WHERE olympiad_id = ? ORDER BY name"

PLAYER_GET = "SELECT id, name FROM players WHERE id = ? AND olympiad_id = ?"

PLAYER_EXISTS = "SELECT id FROM players WHERE id = ? AND olympiad_id = ?"

PLAYER_CREATE = "INSERT INTO players (olympiad_id, name) VALUES (?, ?) RETURNING id, name"

PLAYER_TEAM_CREATE = "INSERT INTO teams (olympiad_id, name) VALUES (?, ?) RETURNING id"

PLAYER_UPDATE = """
UPDATE players SET name = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ? RETURNING id, name
"""

PLAYER_DELETE = "DELETE FROM players WHERE id = ?"


# =============================================================================
# Team Queries
# =============================================================================

TEAM_LIST = """
SELECT t.id, t.name FROM teams t
JOIN team_players tp ON t.id = tp.team_id
WHERE t.olympiad_id = ?
GROUP BY t.id
HAVING COUNT(tp.player_id) > 1
ORDER BY t.name
"""

TEAM_GET = "SELECT id, name FROM teams WHERE id = ? AND olympiad_id = ?"

TEAM_EXISTS = "SELECT id FROM teams WHERE id = ? AND olympiad_id = ?"

TEAM_CREATE = "INSERT INTO teams (olympiad_id, name) VALUES (?, ?) RETURNING id, name"

TEAM_UPDATE = """
UPDATE teams SET name = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ? RETURNING id, name
"""

TEAM_DELETE = "DELETE FROM teams WHERE id = ?"

TEAM_PLAYERS_LIST = """
SELECT p.id, p.name FROM players p
JOIN team_players tp ON p.id = tp.player_id
WHERE tp.team_id = ?
ORDER BY p.name
"""

TEAM_PLAYER_ADD = "INSERT INTO team_players (team_id, player_id) VALUES (?, ?)"

TEAM_PLAYER_EXISTS = "SELECT team_id FROM team_players WHERE team_id = ? AND player_id = ?"

TEAM_PLAYER_REMOVE = "DELETE FROM team_players WHERE team_id = ? AND player_id = ?"

TEAM_PLAYERS_CLEAR = "DELETE FROM team_players WHERE team_id = ?"


# =============================================================================
# Event Queries
# =============================================================================

EVENT_LIST = "SELECT id, name, status, score_kind FROM events WHERE olympiad_id = ? ORDER BY id"

EVENT_GET = "SELECT id, name, status, score_kind FROM events WHERE id = ? AND olympiad_id = ?"

EVENT_EXISTS = "SELECT id FROM events WHERE id = ? AND olympiad_id = ?"

EVENT_CREATE = """
INSERT INTO events (olympiad_id, name, score_kind) VALUES (?, ?, ?)
RETURNING id, name, status, score_kind
"""

EVENT_UPDATE = """
UPDATE events SET name = ?, status = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ? RETURNING id, name, status, score_kind
"""

EVENT_DELETE = "DELETE FROM events WHERE id = ?"

EVENT_TEAMS_LIST = """
SELECT t.id, t.name FROM teams t
JOIN event_teams et ON t.id = et.team_id
WHERE et.event_id = ?
ORDER BY et.seed NULLS LAST, t.name
"""

EVENT_TEAM_ENROLL = "INSERT INTO event_teams (event_id, team_id, seed) VALUES (?, ?, ?)"

EVENT_TEAM_EXISTS = "SELECT event_id FROM event_teams WHERE event_id = ? AND team_id = ?"

EVENT_TEAM_UPDATE = """
UPDATE event_teams SET seed = ?, updated_at = CURRENT_TIMESTAMP
WHERE event_id = ? AND team_id = ?
"""

EVENT_TEAM_REMOVE = "DELETE FROM event_teams WHERE event_id = ? AND team_id = ?"

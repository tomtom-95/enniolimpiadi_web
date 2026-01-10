# =============================================================================
# Olympiad Queries
# =============================================================================

olympiad_list = "SELECT id, name, version FROM olympiads ORDER BY id"

olympiad_get = "SELECT id, name, version FROM olympiads WHERE id = ?"

olympiad_get_internal = "SELECT id, pin, version FROM olympiads WHERE id = ?"

# olympiad_exist = "SELECT id, version FROM olympiads WHERE id = ?"

olympiad_create = "INSERT INTO olympiads (name, pin) VALUES (?, ?) RETURNING id, name, pin, version"

olympiad_update = """
UPDATE olympiads SET name = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND version = ? RETURNING id, name, version
"""

olympiad_delete = "DELETE FROM olympiads WHERE id = ?"


# =============================================================================
# Player Queries
# =============================================================================

player_list = "SELECT id, name, version FROM players WHERE olympiad_id = ?"

PLAYER_GET = "SELECT id, name, version FROM players WHERE id = ? AND olympiad_id = ?"

PLAYER_EXISTS = "SELECT id FROM players WHERE id = ? AND olympiad_id = ?"

player_create = "INSERT INTO players (olympiad_id, name) VALUES (?, ?) RETURNING id, name, version"

participant_create = "INSERT INTO participants (player_id) VALUES (?)"

PLAYER_TEAM_CREATE = "INSERT INTO teams (olympiad_id, name) VALUES (?, ?) RETURNING id"

PLAYER_UPDATE = """
UPDATE players SET name = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND version = ? RETURNING id, name, version
"""

PLAYER_DELETE = "DELETE FROM players WHERE id = ?"


# =============================================================================
# Team Queries
# =============================================================================

# TODO: wrong query, it is possible for a legitimate team to have 0 or 1 player at the
#       moment of the creation, must have a way in the db to distinguish between
#       actual team and the "fake" team composed by only one player
# List only teams with more than one player inside
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


# =============================================================================
# Event Stage Queries
# =============================================================================

STAGE_CREATE = """
INSERT INTO event_stages (event_id, kind, status, stage_order, advance_count)
VALUES (?, ?, 'pending', ?, ?)
RETURNING id
"""

STAGE_LIST = """
SELECT id, kind, status, stage_order, advance_count
FROM event_stages WHERE event_id = ? ORDER BY stage_order
"""

STAGE_GET = "SELECT id, kind, status, stage_order, advance_count FROM event_stages WHERE id = ?"

STAGE_UPDATE_STATUS = """
UPDATE event_stages SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
"""


# =============================================================================
# Group Queries
# =============================================================================

GROUP_CREATE = "INSERT INTO groups (event_stage_id) VALUES (?) RETURNING id"

GROUP_LIST = "SELECT id FROM groups WHERE event_stage_id = ?"

GROUP_TEAM_ADD = "INSERT INTO group_teams (group_id, team_id) VALUES (?, ?)"

GROUP_TEAMS_LIST = """
SELECT t.id, t.name FROM teams t
JOIN group_teams gt ON t.id = gt.team_id
WHERE gt.group_id = ?
ORDER BY t.name
"""


# =============================================================================
# Match Queries
# =============================================================================

MATCH_CREATE = """
INSERT INTO matches (group_id, status) VALUES (?, 'pending')
RETURNING id
"""

MATCH_LIST = """
SELECT m.id, m.status, m.group_id
FROM matches m WHERE m.group_id = ? ORDER BY m.id
"""

MATCH_GET = "SELECT id, status, group_id FROM matches WHERE id = ?"

MATCH_UPDATE_STATUS = """
UPDATE matches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
"""

MATCH_TEAM_ADD = "INSERT INTO match_teams (match_id, team_id) VALUES (?, ?)"

MATCH_TEAMS_LIST = """
SELECT t.id, t.name FROM teams t
JOIN match_teams mt ON t.id = mt.team_id
WHERE mt.match_id = ?
"""

MATCH_SCORE_SET = """
INSERT INTO match_team_scores (match_id, team_id, score)
VALUES (?, ?, ?)
ON CONFLICT (match_id, team_id) DO UPDATE SET score = ?, updated_at = CURRENT_TIMESTAMP
"""

MATCH_SCORES_GET = """
SELECT team_id, score FROM match_team_scores WHERE match_id = ?
"""


# =============================================================================
# Bracket Match Queries
# =============================================================================

BRACKET_MATCH_CREATE = """
INSERT INTO bracket_matches (match_id, next_match_id) VALUES (?, ?)
"""

BRACKET_MATCH_GET = """
SELECT match_id, next_match_id FROM bracket_matches WHERE match_id = ?
"""

BRACKET_MATCH_UPDATE_NEXT = """
UPDATE bracket_matches SET next_match_id = ?, updated_at = CURRENT_TIMESTAMP WHERE match_id = ?
"""

BRACKET_MATCHES_BY_STAGE = """
SELECT m.id as match_id, m.status, bm.next_match_id
FROM matches m
JOIN bracket_matches bm ON m.id = bm.match_id
JOIN groups g ON m.group_id = g.id
WHERE g.event_stage_id = ?
ORDER BY m.id
"""


# =============================================================================
# Stage Kinds Queries
# =============================================================================

STAGE_KINDS_LIST = "SELECT kind, label FROM stage_kinds ORDER BY kind"

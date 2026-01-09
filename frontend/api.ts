// Use the same hostname as the frontend, but port 8001 for the API
const API_BASE = `http://${window.location.hostname}:8001`

// API Types (matching backend responses)
export interface OlympiadSummary {
  id: number
  name: string
  version: number
}

export interface OlympiadDetail {
  id: number
  name: string
  version: number
  players: PlayerResponse[]
  teams: TeamResponse[]
  events: EventResponse[]
}

export interface OlympiadCreateResponse {
  id: number
  name: string
  pin: string
  version: number
}

export interface PlayerResponse {
  id: number
  name: string
  team_id: number | null
  version: number
}

export interface TeamResponse {
  id: number
  name: string
  version: number
}

export interface TeamDetail {
  id: number
  name: string
  players: PlayerResponse[]
}

export interface EventResponse {
  id: number
  name: string
  status: 'registration' | 'started' | 'finished'
  score_kind: 'points' | 'outcome'
  version: number
}

export interface EventDetail {
  id: number
  name: string
  status: 'registration' | 'started' | 'finished'
  score_kind: 'points' | 'outcome'
  teams: TeamResponse[]
}

export interface MatchTeamResponse {
  id: number
  name: string
  score: number | null
}

export interface MatchResponse {
  id: number
  status: 'pending' | 'running' | 'finished'
  teams: MatchTeamResponse[]
  next_match_id: number | null
}

export interface StageResponse {
  id: number
  kind: 'round_robin' | 'single_elimination'
  status: 'pending' | 'running' | 'finished'
  stage_order: number
  advance_count: number | null
  matches: MatchResponse[]
}

export interface EventDetailWithBracket {
  id: number
  name: string
  status: 'registration' | 'started' | 'finished'
  score_kind: 'points' | 'outcome'
  version: number
  teams: TeamResponse[]
  stages: StageResponse[]
}

export interface StageKindResponse {
  kind: string
  label: string
}

export interface StageConfig {
  kind: string
  advance_count: number | null
}

export const api = {
  getStageKinds: (): Promise<Response> =>
    fetch(`${API_BASE}/stage-kinds`),

  getOlympiads: (): Promise<Response> =>
    fetch(`${API_BASE}/olympiads`),

  getOlympiad: (olympiadId: number): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}`),

  createOlympiad: (name: string, pin?: string): Promise<Response> =>
    fetch(`${API_BASE}/olympiads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, pin })
    }),

  renameOlympiad: (olympiadId: number, name: string, pin: string, version: number): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Olympiad-PIN': pin,
        'If-Match': `"${version}"`
      },
      body: JSON.stringify({ name })
    }),

  deleteOlympiad: (olympiadId: number, pin: string, version: number): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}`, {
      method: 'DELETE',
      headers: {
        'X-Olympiad-PIN': pin,
        'If-Match': `"${version}"`
      }
    }),

  verifyPin: (olympiadId: number, pin: string): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    }),

  // Player endpoints
  getPlayers: (olympiadId: number): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/players`),

  createPlayer: (olympiadId: number, name: string, pin: string): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Olympiad-PIN': pin },
      body: JSON.stringify({ name })
    }),

  renamePlayer: (olympiadId: number, playerId: number, name: string, pin: string, version: number): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/players/${playerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Olympiad-PIN': pin, 'If-Match': `"${version}"` },
      body: JSON.stringify({ name })
    }),

  deletePlayer: (olympiadId: number, playerId: number, pin: string, version: number): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/players/${playerId}`, {
      method: 'DELETE',
      headers: { 'X-Olympiad-PIN': pin, 'If-Match': `"${version}"` }
    }),

  // Team endpoints
  getTeams: (olympiadId: number): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/teams`),

  getTeam: (olympiadId: number, teamId: number): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/teams/${teamId}`),

  createTeam: (olympiadId: number, name: string, pin: string, playerIds: number[] = []): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Olympiad-PIN': pin },
      body: JSON.stringify({ name, player_ids: playerIds })
    }),

  renameTeam: (olympiadId: number, teamId: number, name: string, pin: string, version: number, playerIds: number[] = []): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/teams/${teamId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Olympiad-PIN': pin, 'If-Match': `"${version}"` },
      body: JSON.stringify({ name, player_ids: playerIds })
    }),

  deleteTeam: (olympiadId: number, teamId: number, pin: string, version: number): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/teams/${teamId}`, {
      method: 'DELETE',
      headers: { 'X-Olympiad-PIN': pin, 'If-Match': `"${version}"` }
    }),

  addPlayerToTeam: (olympiadId: number, teamId: number, playerId: number, pin: string): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/teams/${teamId}/players/${playerId}`, {
      method: 'POST',
      headers: { 'X-Olympiad-PIN': pin }
    }),

  removePlayerFromTeam: (olympiadId: number, teamId: number, playerId: number, pin: string): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/teams/${teamId}/players/${playerId}`, {
      method: 'DELETE',
      headers: { 'X-Olympiad-PIN': pin }
    }),

  // Event endpoints
  getEvents: (olympiadId: number): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/events`),

  getEvent: (olympiadId: number, eventId: number): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/events/${eventId}`),

  createEvent: (olympiadId: number, name: string, scoreKind: 'points' | 'outcome', pin: string): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Olympiad-PIN': pin },
      body: JSON.stringify({ name, score_kind: scoreKind })
    }),

  updateEvent: (olympiadId: number, eventId: number, pin: string, name: string, version: number, status?: string): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/events/${eventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Olympiad-PIN': pin, 'If-Match': `"${version}"` },
      body: JSON.stringify({ name, status })
    }),

  deleteEvent: (olympiadId: number, eventId: number, pin: string, version: number): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/events/${eventId}`, {
      method: 'DELETE',
      headers: { 'X-Olympiad-PIN': pin, 'If-Match': `"${version}"` }
    }),

  enrollTeam: (olympiadId: number, eventId: number, teamId: number, pin: string, seed?: number): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/events/${eventId}/teams/${teamId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Olympiad-PIN': pin },
      body: JSON.stringify({ seed })
    }),

  unenrollTeam: (olympiadId: number, eventId: number, teamId: number, pin: string): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/events/${eventId}/teams/${teamId}`, {
      method: 'DELETE',
      headers: { 'X-Olympiad-PIN': pin }
    }),

  // Event with stages endpoints
  createEventWithStages: (
    olympiadId: number,
    name: string,
    scoreKind: 'points' | 'outcome',
    stages: StageConfig[],
    teamIds: number[],
    pin: string
  ): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/events/with-stages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Olympiad-PIN': pin },
      body: JSON.stringify({ name, score_kind: scoreKind, stages, team_ids: teamIds })
    }),

  getEventWithBracket: (olympiadId: number, eventId: number): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/events/${eventId}/bracket`),

  // Get all teams including single-player teams for event enrollment
  getAllTeams: (olympiadId: number): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/players`)
}

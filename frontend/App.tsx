import { useState, useEffect } from 'react'
import { create } from 'zustand'
import './App.css'

// Use the same hostname as the frontend, but port 8000 for the API
const API_BASE = `http://${window.location.hostname}:8000`

enum Page {
  OLYMPIAD = 'olympiad',
  EVENTS   = 'events',
  PLAYERS  = 'players',
  TEAMS    = 'teams'
}

// API Types (matching backend responses)
interface OlympiadSummary {
  id: number
  name: string
}

interface OlympiadCreateResponse {
  id: number
  name: string
  pin: string
}

interface PlayerResponse {
  id: number
  name: string
}

interface TeamResponse {
  id: number
  name: string
}

interface TeamDetail {
  id: number
  name: string
  players: PlayerResponse[]
}

interface EventResponse {
  id: number
  name: string
  status: 'registration' | 'started' | 'finished'
  score_kind: 'points' | 'outcome'
}

interface EventDetail {
  id: number
  name: string
  status: 'registration' | 'started' | 'finished'
  score_kind: 'points' | 'outcome'
  teams: TeamResponse[]
}

// UI Types
interface ColorScheme {
  bg: string
  text: string
  hoverBg: string
  hoverText: string
}

// ============================================
// DATA STORE - state and simple setters
// ============================================
interface DataStore {
  olympiads: OlympiadSummary[]
  selectedOlympiad: OlympiadSummary | null
  players: PlayerResponse[]
  selectedPlayer: PlayerResponse | null
  teams: TeamResponse[]
  selectedTeam: TeamDetail | null
  events: EventResponse[]
  selectedEvent: EventDetail | null
  loading: boolean
  error: string | null

  // Setters
  setOlympiads: (olympiads: OlympiadSummary[]) => void
  setPlayers: (players: PlayerResponse[]) => void
  setTeams: (teams: TeamResponse[]) => void
  setEvents: (events: EventResponse[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  selectOlympiad: (id: number) => void
  clearSelectedOlympiad: () => void
  selectPlayer: (id: number) => void
  clearSelectedPlayer: () => void
  selectTeam: (team: TeamDetail) => void
  clearSelectedTeam: () => void
  selectEvent: (event: EventDetail) => void
  clearSelectedEvent: () => void
}

// ============================================
// UI STORE - navigation and rendering state
// ============================================
interface UIStore {
  page: Page
  menuOpen: boolean
  infoModalOpen: boolean
  infoModalTitle: string
  infoModalMessage: string
  // PIN modals
  showPinModal: boolean
  pinModalPin: string
  pinModalOlympiadName: string
  pinInputModalOpen: boolean
  pinInputModalOlympiadId: number | null
  pinInputCallback: ((pin: string) => void) | null
  // Create olympiad modal
  createOlympiadModalOpen: boolean
  createOlympiadName: string
  createOlympiadPin: string
  createOlympiadCallback: ((name: string, pin: string) => void) | null

  setMainPage: (page: Page) => void
  toggleMenu: () => void
  showInfoModal: (title: string, message: string) => void
  closeInfoModal: () => void
  showCreatedPinModal: (olympiadName: string, pin: string) => void
  closeCreatedPinModal: () => void
  requestPin: (olympiadId: number, callback: (pin: string) => void) => void
  closePinInputModal: () => void
  openCreateOlympiadModal: (name: string, callback: (name: string, pin: string) => void) => void
  closeCreateOlympiadModal: () => void
  setCreateOlympiadPin: (pin: string) => void
}

// ============================================
// PIN STORAGE - localStorage helpers
// ============================================
const pinStorage = {
  getPin: (olympiadId: number): string | null => {
    return localStorage.getItem(`olympiad_pin_${olympiadId}`)
  },
  setPin: (olympiadId: number, pin: string): void => {
    localStorage.setItem(`olympiad_pin_${olympiadId}`, pin)
  },
  removePin: (olympiadId: number): void => {
    localStorage.removeItem(`olympiad_pin_${olympiadId}`)
  }
}

// ============================================
// API LAYER - thin fetch wrappers
// ============================================
const api = {
  // Olympiad endpoints
  getOlympiads: (): Promise<Response> =>
    fetch(`${API_BASE}/olympiads`),

  createOlympiad: (name: string, pin?: string): Promise<Response> =>
    fetch(`${API_BASE}/olympiads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, pin })
    }),

  renameOlympiad: (olympiadId: number, name: string, pin: string): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Olympiad-PIN': pin },
      body: JSON.stringify({ name })
    }),

  deleteOlympiad: (olympiadId: number, pin: string): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}`, {
      method: 'DELETE',
      headers: { 'X-Olympiad-PIN': pin }
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

  renamePlayer: (olympiadId: number, playerId: number, name: string, pin: string): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/players/${playerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Olympiad-PIN': pin },
      body: JSON.stringify({ name })
    }),

  deletePlayer: (olympiadId: number, playerId: number, pin: string): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/players/${playerId}`, {
      method: 'DELETE',
      headers: { 'X-Olympiad-PIN': pin }
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

  renameTeam: (olympiadId: number, teamId: number, name: string, pin: string, playerIds: number[] = []): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/teams/${teamId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Olympiad-PIN': pin },
      body: JSON.stringify({ name, player_ids: playerIds })
    }),

  deleteTeam: (olympiadId: number, teamId: number, pin: string): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/teams/${teamId}`, {
      method: 'DELETE',
      headers: { 'X-Olympiad-PIN': pin }
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

  updateEvent: (olympiadId: number, eventId: number, pin: string, name?: string, status?: string): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/events/${eventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Olympiad-PIN': pin },
      body: JSON.stringify({ name, status })
    }),

  deleteEvent: (olympiadId: number, eventId: number, pin: string): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/events/${eventId}`, {
      method: 'DELETE',
      headers: { 'X-Olympiad-PIN': pin }
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
    })
}

// ============================================
// DATA STORE IMPLEMENTATION
// ============================================
const useDataStore = create<DataStore>((set, get) => ({
  olympiads: [],
  players: [],
  selectedPlayer: null,
  teams: [],
  selectedTeam: null,
  events: [],
  selectedEvent: null,
  selectedOlympiad: null,
  loading: false,
  error: null,

  setOlympiads: (olympiads) => set({ olympiads }),
  setPlayers: (players) => set({ players }),
  setTeams: (teams) => set({ teams }),
  setEvents: (events) => set({ events }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  selectOlympiad: (id) => {
    const olympiad = get().olympiads.find((o) => o.id === id) || null
    set({ selectedOlympiad: olympiad })
  },

  clearSelectedOlympiad: () => {
    set({ selectedOlympiad: null })
  },

  selectPlayer: (id) => {
    const player = get().players.find((p) => p.id === id) || null
    set({ selectedPlayer: player })
  },

  clearSelectedPlayer: () => {
    set({ selectedPlayer: null })
  },

  selectTeam: (team) => {
    set({ selectedTeam: team })
  },

  clearSelectedTeam: () => {
    set({ selectedTeam: null })
  },

  selectEvent: (event) => {
    set({ selectedEvent: event })
  },

  clearSelectedEvent: () => {
    set({ selectedEvent: null })
  }
}))

// ============================================
// UI STORE IMPLEMENTATION
// ============================================
const useUIStore = create<UIStore>((set) => ({
  page: Page.OLYMPIAD,
  menuOpen: false,
  infoModalOpen: false,
  infoModalTitle: '',
  infoModalMessage: '',
  showPinModal: false,
  pinModalPin: '',
  pinModalOlympiadName: '',
  pinInputModalOpen: false,
  pinInputModalOlympiadId: null,
  pinInputCallback: null,
  createOlympiadModalOpen: false,
  createOlympiadName: '',
  createOlympiadPin: '',
  createOlympiadCallback: null,

  setMainPage: (page) => set({ page }),
  toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen })),
  showInfoModal: (title, message) => set({ infoModalOpen: true, infoModalTitle: title, infoModalMessage: message }),
  closeInfoModal: () => set({ infoModalOpen: false, infoModalTitle: '', infoModalMessage: '' }),
  showCreatedPinModal: (olympiadName, pin) => set({ showPinModal: true, pinModalOlympiadName: olympiadName, pinModalPin: pin }),
  closeCreatedPinModal: () => set({ showPinModal: false, pinModalPin: '', pinModalOlympiadName: '' }),
  requestPin: (olympiadId, callback) => set({ pinInputModalOpen: true, pinInputModalOlympiadId: olympiadId, pinInputCallback: callback }),
  closePinInputModal: () => set({ pinInputModalOpen: false, pinInputModalOlympiadId: null, pinInputCallback: null }),
  openCreateOlympiadModal: (name, callback) => set({
    createOlympiadModalOpen: true,
    createOlympiadName: name,
    createOlympiadPin: String(Math.floor(Math.random() * 10000)).padStart(4, '0'),
    createOlympiadCallback: callback
  }),
  closeCreateOlympiadModal: () => set({
    createOlympiadModalOpen: false,
    createOlympiadName: '',
    createOlympiadPin: '',
    createOlympiadCallback: null
  }),
  setCreateOlympiadPin: (pin) => set({ createOlympiadPin: pin })
}))

// Colors for buttons
const COLORS: ColorScheme[] = [
  { bg: '#e85d4c', text: '#fff', hoverBg: '#c94a3a', hoverText: '#fff' },
  { bg: '#5bc0be', text: '#2d2a4a', hoverBg: '#45a3a1', hoverText: '#fff' },
  { bg: '#ffb347', text: '#2d2a4a', hoverBg: '#e99d33', hoverText: '#2d2a4a' },
  { bg: '#a78bfa', text: '#fff', hoverBg: '#8b6fe0', hoverText: '#fff' },
  { bg: '#ff6b6b', text: '#fff', hoverBg: '#e55a5a', hoverText: '#fff' },
  { bg: '#4ecdc4', text: '#2d2a4a', hoverBg: '#3dbdb5', hoverText: '#fff' },
  { bg: '#ffe66d', text: '#2d2a4a', hoverBg: '#f5dc5d', hoverText: '#2d2a4a' },
  { bg: '#95e1d3', text: '#2d2a4a', hoverBg: '#7ed3c4', hoverText: '#2d2a4a' },
  { bg: '#dcd6f7', text: '#2d2a4a', hoverBg: '#c9c1ed', hoverText: '#2d2a4a' },
  { bg: '#f8a5c2', text: '#2d2a4a', hoverBg: '#f593b5', hoverText: '#2d2a4a' }
]

// OlympiadBadge Component
function OlympiadBadge() {
  const { selectedOlympiad } = useDataStore()

  if (!selectedOlympiad) {
    return <div className="olympiad-badge empty">Nessuna olimpiade</div>
  } else {
    return <div className="olympiad-badge">{selectedOlympiad.name}</div>
  }
}

function InfoModal() {
  const { infoModalOpen, infoModalTitle, infoModalMessage, closeInfoModal } = useUIStore()

  if (!infoModalOpen) return null

  return (
    <div className="modal-overlay" onClick={closeInfoModal}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>{infoModalTitle}</h2>
        <p className="modal-info-message" style={{ whiteSpace: 'pre-line' }}>{infoModalMessage}</p>
        <button className="modal-ok-button" onClick={closeInfoModal}>
          OK
        </button>
      </div>
    </div>
  )
}

// PIN Display Modal - shown after olympiad creation
function PinDisplayModal() {
  const { showPinModal, pinModalPin, pinModalOlympiadName, closeCreatedPinModal } = useUIStore()

  if (!showPinModal) return null

  return (
    <div className="modal-overlay">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Olimpiade creata</h2>
        <p>L'olimpiade "{pinModalOlympiadName}" e' stata creata.</p>
        <p>Il PIN per modificare questa olimpiade e':</p>
        <p className="pin-display">{pinModalPin}</p>
        <p className="pin-warning">Conserva questo PIN! Ti servira' per modificare l'olimpiade.</p>
        <button className="modal-ok-button" onClick={closeCreatedPinModal}>
          OK
        </button>
      </div>
    </div>
  )
}

// PIN Input Modal - shown when PIN is needed
function PinInputModal() {
  const { pinInputModalOpen, pinInputModalOlympiadId, pinInputCallback, closePinInputModal } = useUIStore()
  const [pinValue, setPinValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!pinInputModalOpen || !pinInputModalOlympiadId) return null

  const handleSubmit = async () => {
    setError(null)
    if (pinValue.length !== 4) {
      setError('Il PIN deve essere di 4 cifre')
      return
    }

    // Verify PIN with backend
    const res = await api.verifyPin(pinInputModalOlympiadId, pinValue)
    if (res.ok) {
      // Store PIN and call callback
      pinStorage.setPin(pinInputModalOlympiadId, pinValue)
      const callback = pinInputCallback
      closePinInputModal()
      setPinValue('')
      setError(null)
      if (callback) {
        callback(pinValue)
      }
    } else {
      setError('PIN non valido')
    }
  }

  const handleCancel = () => {
    closePinInputModal()
    setPinValue('')
    setError(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Inserisci PIN</h2>
        <p>Inserisci il PIN dell'olimpiade per continuare:</p>
        <input
          type="text"
          className="pin-input"
          maxLength={4}
          value={pinValue}
          onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
          onKeyDown={handleKeyDown}
          autoFocus
          placeholder="0000"
        />
        {error && <p className="pin-error">{error}</p>}
        <div className="modal-buttons">
          <button className="modal-cancel-button" onClick={handleCancel}>
            Annulla
          </button>
          <button className="modal-ok-button" onClick={handleSubmit}>
            Conferma
          </button>
        </div>
      </div>
    </div>
  )
}

// Create Olympiad Modal - shown when creating a new olympiad
function CreateOlympiadModal() {
  const {
    createOlympiadModalOpen,
    createOlympiadName,
    createOlympiadPin,
    createOlympiadCallback,
    closeCreateOlympiadModal,
    setCreateOlympiadPin
  } = useUIStore()
  const [error, setError] = useState<string | null>(null)

  if (!createOlympiadModalOpen) return null

  const handleSubmit = () => {
    setError(null)
    if (createOlympiadPin.length !== 4 || !/^\d{4}$/.test(createOlympiadPin)) {
      setError('Il PIN deve essere di 4 cifre')
      return
    }
    const callback = createOlympiadCallback
    const name = createOlympiadName
    const pin = createOlympiadPin
    closeCreateOlympiadModal()
    setError(null)
    if (callback) {
      callback(name, pin)
    }
  }

  const handleCancel = () => {
    closeCreateOlympiadModal()
    setError(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Crea olimpiade</h2>
        <p>Nome: <strong>{createOlympiadName}</strong></p>
        <p>PIN per modificare l'olimpiade:</p>
        <input
          type="text"
          className="pin-input"
          maxLength={4}
          value={createOlympiadPin}
          onChange={(e) => setCreateOlympiadPin(e.target.value.replace(/\D/g, ''))}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <p className="pin-warning">Puoi modificare il PIN o usare quello generato.</p>
        {error && <p className="pin-error">{error}</p>}
        <div className="modal-buttons">
          <button className="modal-cancel-button" onClick={handleCancel}>
            Annulla
          </button>
          <button className="modal-ok-button" onClick={handleSubmit}>
            Crea
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const { page } = useUIStore()
  const { selectedEvent, selectedPlayer, selectedTeam } = useDataStore()

  return (
    <div className="app-wrapper">
      <HamburgerButton />
      <SideMenu />
      <InfoModal />
      <PinDisplayModal />
      <PinInputModal />
      <CreateOlympiadModal />
      <main className="page-content">
        <div className="olympiad-bar">
          <OlympiadBadge />
        </div>
        {page === Page.OLYMPIAD && <Olympiads />}
        {page === Page.EVENTS && (selectedEvent ? <EventDetailView /> : <Events />)}
        {page === Page.PLAYERS && (selectedPlayer ? <PlayerDetail /> : <Players />)}
        {page === Page.TEAMS && (selectedTeam ? <TeamDetailView /> : <Teams />)}
      </main>
    </div>
  )
}

// HamburgerButton Component
function HamburgerButton() {
  const { menuOpen, toggleMenu } = useUIStore()

  return (
    <button className={`hamburger ${menuOpen ? 'open' : ''}`} onClick={toggleMenu}>
      <span></span>
      <span></span>
      <span></span>
    </button>
  )
}

function SideMenu() {
  const { page, menuOpen, setMainPage } = useUIStore()
  const { clearSelectedPlayer, clearSelectedEvent, clearSelectedTeam } = useDataStore()

  const handleNavigation = (targetPage: Page) => {
    clearSelectedPlayer()
    clearSelectedEvent()
    clearSelectedTeam()
    setMainPage(targetPage)
  }

  return (
    <nav className={`side-menu ${menuOpen ? 'open' : ''}`}>
      <button
        className={`menu-item ${page === Page.OLYMPIAD ? 'active' : ''}`}
        onClick={() => handleNavigation(Page.OLYMPIAD)}
      >
        Olimpiadi
      </button>
      <button
        className={`menu-item ${page === Page.EVENTS ? 'active' : ''}`}
        onClick={() => handleNavigation(Page.EVENTS)}
      >
        Eventi
      </button>
      <button
        className={`menu-item ${page === Page.TEAMS ? 'active' : ''}`}
        onClick={() => handleNavigation(Page.TEAMS)}
      >
        Squadre
      </button>
      <button
        className={`menu-item ${page === Page.PLAYERS ? 'active' : ''}`}
        onClick={() => handleNavigation(Page.PLAYERS)}
      >
        Giocatori
      </button>
    </nav>
  )
}

interface ItemButtonProps {
  label: string
  color: ColorScheme
  onClick: () => void
  onRename: (newName: string) => void
  onDelete: () => void
}

function ItemButton({ label, color, onClick, onRename, onDelete }: ItemButtonProps) {
  const [hovered, setHovered] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(label)

  const style = {
    backgroundColor: hovered ? color.hoverBg : color.bg,
    color: hovered ? color.hoverText : color.text
  }

  const handleRenameClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditValue(label)
    setIsEditing(true)
  }

  const handleRenameSubmit = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== label) {
      onRename(trimmed)
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditValue(label)
    }
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete()
  }

  if (isEditing) {
    return (
      <div className="item-button item-button-editing" style={style}>
        <input
          type="text"
          className="item-rename-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleRenameSubmit}
          autoFocus
        />
      </div>
    )
  }

  return (
    <div
      className="item-button"
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <span className="item-label">{label}</span>
      <div className="item-actions">
        <button className="item-action-btn rename-btn" onClick={handleRenameClick} title="Rinomina">
          <span className="icon-pencil"></span>
        </button>
        <button className="item-action-btn delete-btn" onClick={handleDeleteClick} title="Elimina">
          <span className="icon-trash"></span>
        </button>
      </div>
    </div>
  )
}

interface AddItemInputProps {
  placeholder: string
  onAdd: (value: string) => void
}

function AddItemInput({ placeholder, onAdd }: AddItemInputProps) {
  const [value, setValue] = useState('')

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (trimmed) {
      onAdd(trimmed)
      setValue('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    }
  }

  return (
    <div className="add-item-container">
      <input
        type="text"
        className="add-item-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button className="add-item-button" onClick={handleSubmit}>
        +
      </button>
    </div>
  )
}

// Olympiads Component
function Olympiads() {
  const { olympiads, setOlympiads, selectOlympiad } = useDataStore()
  const { showInfoModal, requestPin, openCreateOlympiadModal } = useUIStore()

  const fetchOlympiads = async () => {
    const res = await api.getOlympiads()
    if (res.ok) {
      const data: OlympiadSummary[] = await res.json()
      setOlympiads(data)
    }
  }

  useEffect(() => {
    fetchOlympiads()
  }, [])

  const doCreate = async (name: string, pin: string) => {
    const res = await api.createOlympiad(name, pin)
    if (!res.ok) {
      const error: { detail?: string } = await res.json()
      showInfoModal('Errore', error.detail || 'Impossibile creare l\'olimpiade')
      fetchOlympiads()
      return
    }
    const data: OlympiadCreateResponse = await res.json()
    pinStorage.setPin(data.id, data.pin)
    setOlympiads([...olympiads, { id: data.id, name: data.name }])
  }

  const handleCreate = (name: string) => {
    openCreateOlympiadModal(name, doCreate)
  }

  const doRename = async (olympiad: OlympiadSummary, newName: string, pin: string) => {
    const res = await api.renameOlympiad(olympiad.id, newName, pin)
    if (!res.ok) {
      const error: { detail?: string } = await res.json()
      if (res.status === 401) {
        pinStorage.removePin(olympiad.id)
        showInfoModal('Errore', 'PIN non valido')
      } else {
        showInfoModal('Errore', error.detail || 'Impossibile rinominare l\'olimpiade')
      }
    }
    fetchOlympiads()
  }

  const handleRename = (olympiad: OlympiadSummary, newName: string) => {
    const pin = pinStorage.getPin(olympiad.id)
    if (pin) {
      doRename(olympiad, newName, pin)
    } else {
      requestPin(olympiad.id, (enteredPin) => {
        doRename(olympiad, newName, enteredPin)
      })
    }
  }

  const doDelete = async (olympiad: OlympiadSummary, pin: string) => {
    const res = await api.deleteOlympiad(olympiad.id, pin)
    if (!res.ok) {
      const error: { detail?: string } = await res.json()
      if (res.status === 401) {
        pinStorage.removePin(olympiad.id)
        showInfoModal('Errore', 'PIN non valido')
      } else {
        showInfoModal('Errore', error.detail || 'Impossibile eliminare l\'olimpiade')
      }
    } else {
      pinStorage.removePin(olympiad.id)
    }
    fetchOlympiads()
  }

  const handleDelete = (olympiad: OlympiadSummary) => {
    if (!confirm(`Sei sicuro di voler eliminare "${olympiad.name}"?`)) return
    const pin = pinStorage.getPin(olympiad.id)
    if (pin) {
      doDelete(olympiad, pin)
    } else {
      requestPin(olympiad.id, (enteredPin) => {
        doDelete(olympiad, enteredPin)
      })
    }
  }

  return (
    <div className="app-container">
      <AddItemInput placeholder="Nuova olimpiade..." onAdd={handleCreate} />
      <div className="items-list">
        {olympiads.map((olympiad, i) => (
          <ItemButton
            key={olympiad.id}
            label={olympiad.name}
            color={COLORS[i % COLORS.length]}
            onClick={() => selectOlympiad(olympiad.id)}
            onRename={(newName) => handleRename(olympiad, newName)}
            onDelete={() => handleDelete(olympiad)}
          />
        ))}
      </div>
    </div>
  )
}

// Events Component
function Events() {
  const { selectedOlympiad, events, setEvents, clearSelectedOlympiad, setOlympiads, selectEvent } = useDataStore()
  const { setMainPage, showInfoModal, requestPin } = useUIStore()

  const fetchEvents = async () => {
    if (!selectedOlympiad) return
    const res = await api.getEvents(selectedOlympiad.id)
    if (res.ok) {
      const data: EventResponse[] = await res.json()
      setEvents(data)
    } else if (res.status === 404) {
      clearSelectedOlympiad()
      setMainPage(Page.OLYMPIAD)
      const olympiadsRes = await api.getOlympiads()
      if (olympiadsRes.ok) {
        setOlympiads(await olympiadsRes.json())
      }
    }
  }

  useEffect(() => {
    if (selectedOlympiad) {
      fetchEvents()
    }
  }, [selectedOlympiad])

  if (!selectedOlympiad) {
    return (
      <div className="app-container">
        <p className="empty-message">Seleziona un'olimpiade per vedere gli eventi</p>
      </div>
    )
  }

  const doCreate = async (name: string, pin: string) => {
    const res = await api.createEvent(selectedOlympiad.id, name, 'points', pin)
    if (!res.ok) {
      const error: { detail?: string } = await res.json()
      if (res.status === 404) {
        clearSelectedOlympiad()
        setMainPage(Page.OLYMPIAD)
        showInfoModal('Olimpiade non trovata', 'Questa olimpiade è stata eliminata.')
        const olympiadsRes = await api.getOlympiads()
        if (olympiadsRes.ok) {
          setOlympiads(await olympiadsRes.json())
        }
      } else if (res.status === 401) {
        pinStorage.removePin(selectedOlympiad.id)
        showInfoModal('Errore', 'PIN non valido')
      } else {
        showInfoModal('Errore', error.detail || 'Impossibile creare l\'evento')
        fetchEvents()
      }
      return
    }
    const newEvent: EventResponse = await res.json()
    setEvents([...events, newEvent])
  }

  const handleCreate = (name: string) => {
    const pin = pinStorage.getPin(selectedOlympiad.id)
    if (pin) {
      doCreate(name, pin)
    } else {
      requestPin(selectedOlympiad.id, (enteredPin) => {
        doCreate(name, enteredPin)
      })
    }
  }

  const doRename = async (event: EventResponse, newName: string, pin: string) => {
    const res = await api.updateEvent(selectedOlympiad.id, event.id, pin, newName)
    if (!res.ok) {
      const error: { detail?: string } = await res.json()
      if (res.status === 401) {
        pinStorage.removePin(selectedOlympiad.id)
        showInfoModal('Errore', 'PIN non valido')
      } else {
        showInfoModal('Errore', error.detail || 'Impossibile rinominare l\'evento')
      }
    }
    fetchEvents()
  }

  const handleRename = (event: EventResponse, newName: string) => {
    const pin = pinStorage.getPin(selectedOlympiad.id)
    if (pin) {
      doRename(event, newName, pin)
    } else {
      requestPin(selectedOlympiad.id, (enteredPin) => {
        doRename(event, newName, enteredPin)
      })
    }
  }

  const doDelete = async (event: EventResponse, pin: string) => {
    const res = await api.deleteEvent(selectedOlympiad.id, event.id, pin)
    if (!res.ok) {
      const error: { detail?: string } = await res.json()
      if (res.status === 401) {
        pinStorage.removePin(selectedOlympiad.id)
        showInfoModal('Errore', 'PIN non valido')
      } else {
        showInfoModal('Errore', error.detail || 'Impossibile eliminare l\'evento')
      }
    }
    fetchEvents()
  }

  const handleDelete = (event: EventResponse) => {
    if (!confirm(`Sei sicuro di voler eliminare "${event.name}"?`)) return
    const pin = pinStorage.getPin(selectedOlympiad.id)
    if (pin) {
      doDelete(event, pin)
    } else {
      requestPin(selectedOlympiad.id, (enteredPin) => {
        doDelete(event, enteredPin)
      })
    }
  }

  const handleSelect = async (event: EventResponse) => {
    const res = await api.getEvent(selectedOlympiad.id, event.id)
    if (res.ok) {
      const detail: EventDetail = await res.json()
      selectEvent(detail)
    }
  }

  return (
    <div className="app-container">
      <AddItemInput placeholder="Nuovo evento..." onAdd={handleCreate} />
      <div className="items-list">
        {events.map((event, i) => (
          <ItemButton
            key={event.id}
            label={event.name}
            color={COLORS[i % COLORS.length]}
            onClick={() => handleSelect(event)}
            onRename={(newName) => handleRename(event, newName)}
            onDelete={() => handleDelete(event)}
          />
        ))}
      </div>
    </div>
  )
}

// Teams Component
function Teams() {
  const { selectedOlympiad, teams, setTeams, clearSelectedOlympiad, setOlympiads, selectTeam } = useDataStore()
  const { setMainPage, showInfoModal, requestPin } = useUIStore()

  const fetchTeams = async () => {
    if (!selectedOlympiad) return
    const res = await api.getTeams(selectedOlympiad.id)
    if (res.ok) {
      const data: TeamResponse[] = await res.json()
      setTeams(data)
    } else if (res.status === 404) {
      clearSelectedOlympiad()
      setMainPage(Page.OLYMPIAD)
      const olympiadsRes = await api.getOlympiads()
      if (olympiadsRes.ok) {
        setOlympiads(await olympiadsRes.json())
      }
    }
  }

  useEffect(() => {
    if (selectedOlympiad) {
      fetchTeams()
    }
  }, [selectedOlympiad])

  if (!selectedOlympiad) {
    return (
      <div className="app-container">
        <p className="empty-message">Seleziona un'olimpiade per vedere le squadre</p>
      </div>
    )
  }

  const doCreate = async (name: string, pin: string) => {
    const res = await api.createTeam(selectedOlympiad.id, name, pin)
    if (!res.ok) {
      const error: { detail?: string } = await res.json()
      if (res.status === 404) {
        clearSelectedOlympiad()
        setMainPage(Page.OLYMPIAD)
        showInfoModal('Olimpiade non trovata', 'Questa olimpiade è stata eliminata.')
        const olympiadsRes = await api.getOlympiads()
        if (olympiadsRes.ok) {
          setOlympiads(await olympiadsRes.json())
        }
      } else if (res.status === 401) {
        pinStorage.removePin(selectedOlympiad.id)
        showInfoModal('Errore', 'PIN non valido')
      } else {
        showInfoModal('Errore', error.detail || 'Impossibile creare la squadra')
        fetchTeams()
      }
      return
    }
    const newTeam: TeamResponse = await res.json()
    setTeams([...teams, newTeam])
  }

  const handleCreate = (name: string) => {
    const pin = pinStorage.getPin(selectedOlympiad.id)
    if (pin) {
      doCreate(name, pin)
    } else {
      requestPin(selectedOlympiad.id, (enteredPin) => {
        doCreate(name, enteredPin)
      })
    }
  }

  const doRename = async (team: TeamResponse, newName: string, pin: string) => {
    const res = await api.renameTeam(selectedOlympiad.id, team.id, newName, pin)
    if (!res.ok) {
      const error: { detail?: string } = await res.json()
      if (res.status === 401) {
        pinStorage.removePin(selectedOlympiad.id)
        showInfoModal('Errore', 'PIN non valido')
      } else {
        showInfoModal('Errore', error.detail || 'Impossibile rinominare la squadra')
      }
    }
    fetchTeams()
  }

  const handleRename = (team: TeamResponse, newName: string) => {
    const pin = pinStorage.getPin(selectedOlympiad.id)
    if (pin) {
      doRename(team, newName, pin)
    } else {
      requestPin(selectedOlympiad.id, (enteredPin) => {
        doRename(team, newName, enteredPin)
      })
    }
  }

  const doDelete = async (team: TeamResponse, pin: string) => {
    const res = await api.deleteTeam(selectedOlympiad.id, team.id, pin)
    if (!res.ok) {
      const error: { detail?: string } = await res.json()
      if (res.status === 401) {
        pinStorage.removePin(selectedOlympiad.id)
        showInfoModal('Errore', 'PIN non valido')
      } else {
        showInfoModal('Errore', error.detail || 'Impossibile eliminare la squadra')
      }
    }
    fetchTeams()
  }

  const handleDelete = (team: TeamResponse) => {
    if (!confirm(`Sei sicuro di voler eliminare "${team.name}"?`)) return
    const pin = pinStorage.getPin(selectedOlympiad.id)
    if (pin) {
      doDelete(team, pin)
    } else {
      requestPin(selectedOlympiad.id, (enteredPin) => {
        doDelete(team, enteredPin)
      })
    }
  }

  const handleSelect = async (team: TeamResponse) => {
    const res = await api.getTeam(selectedOlympiad.id, team.id)
    if (res.ok) {
      const detail: TeamDetail = await res.json()
      selectTeam(detail)
    }
  }

  return (
    <div className="app-container">
      <AddItemInput placeholder="Nuova squadra..." onAdd={handleCreate} />
      <div className="items-list">
        {teams.map((team, i) => (
          <ItemButton
            key={team.id}
            label={team.name}
            color={COLORS[i % COLORS.length]}
            onClick={() => handleSelect(team)}
            onRename={(newName) => handleRename(team, newName)}
            onDelete={() => handleDelete(team)}
          />
        ))}
      </div>
    </div>
  )
}

// Players Component
function Players() {
  const { selectedOlympiad, players, setPlayers, clearSelectedOlympiad, setOlympiads, selectPlayer } = useDataStore()
  const { setMainPage, showInfoModal, requestPin } = useUIStore()

  const fetchPlayers = async () => {
    if (!selectedOlympiad) return
    const res = await api.getPlayers(selectedOlympiad.id)
    if (res.ok) {
      const data: PlayerResponse[] = await res.json()
      setPlayers(data)
    } else if (res.status === 404) {
      clearSelectedOlympiad()
      setMainPage(Page.OLYMPIAD)
      const olympiadsRes = await api.getOlympiads()
      if (olympiadsRes.ok) {
        setOlympiads(await olympiadsRes.json())
      }
    }
  }

  useEffect(() => {
    if (selectedOlympiad) {
      fetchPlayers()
    }
  }, [selectedOlympiad])

  if (!selectedOlympiad) {
    return (
      <div className="app-container">
        <p className="empty-message">Seleziona un'olimpiade per vedere i giocatori</p>
      </div>
    )
  }

  const doCreate = async (name: string, pin: string) => {
    const res = await api.createPlayer(selectedOlympiad.id, name, pin)
    if (!res.ok) {
      const error: { detail?: string } = await res.json()
      if (res.status === 404) {
        clearSelectedOlympiad()
        setMainPage(Page.OLYMPIAD)
        showInfoModal('Olimpiade non trovata', 'Questa olimpiade è stata eliminata.')
        const olympiadsRes = await api.getOlympiads()
        if (olympiadsRes.ok) {
          setOlympiads(await olympiadsRes.json())
        }
      } else if (res.status === 401) {
        pinStorage.removePin(selectedOlympiad.id)
        showInfoModal('Errore', 'PIN non valido')
      } else {
        showInfoModal('Errore', error.detail || 'Impossibile creare il giocatore')
        fetchPlayers()
      }
      return
    }
    const newPlayer: PlayerResponse = await res.json()
    setPlayers([...players, newPlayer])
  }

  const handleCreate = (name: string) => {
    const pin = pinStorage.getPin(selectedOlympiad.id)
    if (pin) {
      doCreate(name, pin)
    } else {
      requestPin(selectedOlympiad.id, (enteredPin) => {
        doCreate(name, enteredPin)
      })
    }
  }

  const doRename = async (player: PlayerResponse, newName: string, pin: string) => {
    const res = await api.renamePlayer(selectedOlympiad.id, player.id, newName, pin)
    if (!res.ok) {
      const error: { detail?: string } = await res.json()
      if (res.status === 401) {
        pinStorage.removePin(selectedOlympiad.id)
        showInfoModal('Errore', 'PIN non valido')
      } else {
        showInfoModal('Errore', error.detail || 'Impossibile rinominare il giocatore')
      }
    }
    fetchPlayers()
  }

  const handleRename = (player: PlayerResponse, newName: string) => {
    const pin = pinStorage.getPin(selectedOlympiad.id)
    if (pin) {
      doRename(player, newName, pin)
    } else {
      requestPin(selectedOlympiad.id, (enteredPin) => {
        doRename(player, newName, enteredPin)
      })
    }
  }

  const doDelete = async (player: PlayerResponse, pin: string) => {
    const res = await api.deletePlayer(selectedOlympiad.id, player.id, pin)
    if (!res.ok) {
      const error: { detail?: string } = await res.json()
      if (res.status === 401) {
        pinStorage.removePin(selectedOlympiad.id)
        showInfoModal('Errore', 'PIN non valido')
      } else {
        showInfoModal('Errore', error.detail || 'Impossibile eliminare il giocatore')
      }
    }
    fetchPlayers()
  }

  const handleDelete = (player: PlayerResponse) => {
    if (!confirm(`Sei sicuro di voler eliminare "${player.name}"?`)) return
    const pin = pinStorage.getPin(selectedOlympiad.id)
    if (pin) {
      doDelete(player, pin)
    } else {
      requestPin(selectedOlympiad.id, (enteredPin) => {
        doDelete(player, enteredPin)
      })
    }
  }

  return (
    <div className="app-container">
      <AddItemInput placeholder="Nuovo giocatore..." onAdd={handleCreate} />
      <div className="items-list">
        {players.map((player, i) => (
          <ItemButton
            key={player.id}
            label={player.name}
            color={COLORS[i % COLORS.length]}
            onClick={() => selectPlayer(player.id)}
            onRename={(newName) => handleRename(player, newName)}
            onDelete={() => handleDelete(player)}
          />
        ))}
      </div>
    </div>
  )
}

// Event Detail Component
function EventDetailView() {
  const { selectedEvent, clearSelectedEvent } = useDataStore()

  if (!selectedEvent) return null

  const statusLabel = {
    registration: 'Iscrizioni aperte',
    started: 'In corso',
    finished: 'Terminato'
  }

  const scoreKindLabel = {
    points: 'Punteggio',
    outcome: 'Vittoria/Sconfitta'
  }

  return (
    <div className="app-container">
      <button className="back-button" onClick={clearSelectedEvent}>← Torna agli eventi</button>
      <h2 className="detail-title">{selectedEvent.name}</h2>
      <p>Stato: {statusLabel[selectedEvent.status]}</p>
      <p>Tipo punteggio: {scoreKindLabel[selectedEvent.score_kind]}</p>
      <h3>Squadre iscritte:</h3>
      {selectedEvent.teams.length === 0 ? (
        <p className="empty-message">Nessuna squadra iscritta</p>
      ) : (
        <ul>
          {selectedEvent.teams.map((team) => (
            <li key={team.id}>{team.name}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Team Detail Component
function TeamDetailView() {
  const { selectedTeam, clearSelectedTeam } = useDataStore()

  if (!selectedTeam) return null

  return (
    <div className="app-container">
      <button className="back-button" onClick={clearSelectedTeam}>← Torna alle squadre</button>
      <h2 className="detail-title">{selectedTeam.name}</h2>
      <h3>Giocatori:</h3>
      {selectedTeam.players.length === 0 ? (
        <p className="empty-message">Nessun giocatore nella squadra</p>
      ) : (
        <ul>
          {selectedTeam.players.map((player) => (
            <li key={player.id}>{player.name}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Player Detail Component
function PlayerDetail() {
  const { selectedPlayer, clearSelectedPlayer } = useDataStore()

  return (
    <div className="app-container">
      <button className="back-button" onClick={clearSelectedPlayer}>← Torna ai giocatori</button>
      <h2 className="detail-title">{selectedPlayer!.name}</h2>
    </div>
  )
}

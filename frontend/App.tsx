import { useState, useEffect } from 'react'
import { create } from 'zustand'
import './App.css'

// Use the same hostname as the frontend, but port 8001 for the API
const API_BASE = `http://${window.location.hostname}:8001`

enum Page {
  OLYMPIAD = 'olympiad',
  EVENTS   = 'events',
  PLAYERS  = 'players'
}

// API Types (matching backend responses)
interface OlympiadSummary {
  name: string
  version: number
}

interface PlayerResponse {
  id: number
  name: string
  version: number
}

interface TournamentResponse {
  id: number
  name: string
  type: 'round_robin' | 'single_elimination' | 'double_elimination'
  status: 'pending' | 'in_progress' | 'completed'
  version: number
}

interface OlympiadDetail {
  id: number
  name: string
  pin: string
  version: number
  players: PlayerResponse[]
  tournaments: TournamentResponse[]
}

// UI Types
interface ColorScheme {
  bg: string
  text: string
  hoverBg: string
  hoverText: string
}

// ============================================
// DATA STORE - business logic and data
// ============================================
interface DataStore {
  olympiads: OlympiadSummary[]
  selectedOlympiad: string
  selectedOlympiadData: OlympiadDetail | null
  loading: boolean
  error: string | null

  // Olympiad actions
  // setOlympiads: (olympiads: string[]) => void
  selectOlympiad: (name: string) => void
  fetchOlympiads: () => Promise<void>
  fetchOlympiadDetail: (name: string) => Promise<void>
  createOlympiad: (name: string) => Promise<{ name: string; pin: string }>
  renameOlympiad: (oldName: string, newName: string, version: number) => Promise<void>
  deleteOlympiad: (name: string) => Promise<void>

  // Player actions
  createPlayer: (name: string) => Promise<void>
  renamePlayer: (playerId: number, newName: string, version: number) => Promise<void>
  deletePlayer: (playerId: number) => Promise<void>

  // Tournament actions
  createTournament: (name: string, type: TournamentResponse['type']) => Promise<void>
  renameTournament: (tournamentId: number, newName: string, version: number) => Promise<void>
  deleteTournament: (tournamentId: number) => Promise<void>
}

// ============================================
// UI STORE - navigation and rendering state
// ============================================
interface UIStore {
  page: Page
  menuOpen: boolean
  modalOpen: boolean
  modalPIN: string
  modalOlympiadName: string

  setMainPage: (page: Page) => void
  toggleMenu: () => void
  showPINModal: (name: string, pin: string) => void
  closePINModal: () => void
}

// localStorage helpers for PIN storage
function savePIN(olympiad: string, pin: string) {
  const pins = JSON.parse(localStorage.getItem('olympiadPINs') || '{}')
  pins[olympiad] = pin
  localStorage.setItem('olympiadPINs', JSON.stringify(pins))
}

// ============================================
// DATA STORE IMPLEMENTATION
// ============================================
const useDataStore = create<DataStore>((set, get) => ({
  olympiads: [],
  selectedOlympiad: '',
  selectedOlympiadData: null,
  loading: false,
  error: null,

  // setOlympiads: (olympiads) => set({ olympiads }),

  selectOlympiad: (name) => {
    set({ selectedOlympiad: name, selectedOlympiadData: null })
    if (name) {
      get().fetchOlympiadDetail(name)
    }
  },

  fetchOlympiads: async () => {
    try {
      set({ loading: true, error: null })
      const res = await fetch(`${API_BASE}/olympiads`)
      if (!res.ok) throw new Error('Failed to fetch olympiads')
      const data = await res.json()
      set({ olympiads: data, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  fetchOlympiadDetail: async (name: string) => {
    try {
      set({ loading: true, error: null })
      const res = await fetch(`${API_BASE}/olympiads/${encodeURIComponent(name)}`)
      if (!res.ok) {
        if (res.status === 404) {
          set({ selectedOlympiad: '', selectedOlympiadData: null, loading: false })
          get().fetchOlympiads()
          return
        }
        throw new Error('Failed to fetch olympiad details')
      }
      const data = await res.json()
      set({ selectedOlympiadData: data, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  createOlympiad: async (name: string) => {
    const res = await fetch(`${API_BASE}/olympiads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.detail || 'Failed to create olympiad')
    }
    const data = await res.json()
    savePIN(data.name, data.pin)
    set((s) => ({ olympiads: [...s.olympiads, { name: data.name, version: data.version }] }))
    return data
  },

  renameOlympiad: async (oldName: string, newName: string, version: number) => {
    const res = await fetch(`${API_BASE}/olympiads/${encodeURIComponent(oldName)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, version })
    })
    if (!res.ok) {
      const error = await res.json()
      if (res.status === 409) {
        alert('This olympiad was modified by another user. Refreshing...')
        get().fetchOlympiads()
        return
      }
      throw new Error(error.detail || 'Failed to rename olympiad')
    }
    const responseData = await res.json()
    set((s) => ({
      olympiads: s.olympiads.map((o) =>
        o.name === oldName ? { name: responseData.name, version: responseData.version } : o
      ),
      selectedOlympiad: s.selectedOlympiad === oldName ? newName : s.selectedOlympiad
    }))
    // Refresh detail if this is the selected olympiad
    if (get().selectedOlympiad === newName) {
      get().fetchOlympiadDetail(newName)
    }
  },

  deleteOlympiad: async (name: string) => {
    const res = await fetch(`${API_BASE}/olympiads/${encodeURIComponent(name)}`, {
      method: 'DELETE'
    })
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.detail || 'Failed to delete olympiad')
    }
    set((s) => ({
      olympiads: s.olympiads.filter((o) => o.name !== name),
      selectedOlympiad: s.selectedOlympiad === name ? '' : s.selectedOlympiad,
      selectedOlympiadData: s.selectedOlympiad === name ? null : s.selectedOlympiadData
    }))
  },

  // Player actions
  createPlayer: async (name: string) => {
    const olympiadName = get().selectedOlympiad
    if (!olympiadName) return

    const res = await fetch(`${API_BASE}/olympiads/${encodeURIComponent(olympiadName)}/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.detail || 'Failed to create player')
    }
    // Refresh olympiad data to get updated player list
    get().fetchOlympiadDetail(olympiadName)
  },

  renamePlayer: async (playerId: number, newName: string, version: number) => {
    const olympiadName = get().selectedOlympiad
    if (!olympiadName) return

    const res = await fetch(
      `${API_BASE}/olympiads/${encodeURIComponent(olympiadName)}/players/${playerId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, version })
      }
    )
    if (!res.ok) {
      const error = await res.json()
      if (res.status === 409) {
        alert('This player was modified by another user. Refreshing...')
        get().fetchOlympiadDetail(olympiadName)
        return
      }
      throw new Error(error.detail || 'Failed to rename player')
    }
    get().fetchOlympiadDetail(olympiadName)
  },

  deletePlayer: async (playerId: number) => {
    const olympiadName = get().selectedOlympiad
    if (!olympiadName) return

    const res = await fetch(
      `${API_BASE}/olympiads/${encodeURIComponent(olympiadName)}/players/${playerId}`,
      { method: 'DELETE' }
    )
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.detail || 'Failed to delete player')
    }
    get().fetchOlympiadDetail(olympiadName)
  },

  // Tournament actions
  createTournament: async (name: string, type: TournamentResponse['type']) => {
    const olympiadName = get().selectedOlympiad
    if (!olympiadName) return

    const res = await fetch(
      `${API_BASE}/olympiads/${encodeURIComponent(olympiadName)}/tournaments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type })
      }
    )
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.detail || 'Failed to create tournament')
    }
    get().fetchOlympiadDetail(olympiadName)
  },

  renameTournament: async (tournamentId: number, newName: string, version: number) => {
    const olympiadName = get().selectedOlympiad
    if (!olympiadName) return

    const res = await fetch(
      `${API_BASE}/olympiads/${encodeURIComponent(olympiadName)}/tournaments/${tournamentId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, version })
      }
    )
    if (!res.ok) {
      const error = await res.json()
      if (res.status === 409) {
        alert('This tournament was modified by another user. Refreshing...')
        get().fetchOlympiadDetail(olympiadName)
        return
      }
      throw new Error(error.detail || 'Failed to rename tournament')
    }
    get().fetchOlympiadDetail(olympiadName)
  },

  deleteTournament: async (tournamentId: number) => {
    const olympiadName = get().selectedOlympiad
    if (!olympiadName) return

    const res = await fetch(
      `${API_BASE}/olympiads/${encodeURIComponent(olympiadName)}/tournaments/${tournamentId}`,
      { method: 'DELETE' }
    )
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.detail || 'Failed to delete tournament')
    }
    get().fetchOlympiadDetail(olympiadName)
  }
}))

// ============================================
// UI STORE IMPLEMENTATION
// ============================================
const useUIStore = create<UIStore>((set) => ({
  page: Page.OLYMPIAD,
  menuOpen: false,
  modalOpen: false,
  modalPIN: '',
  modalOlympiadName: '',

  setMainPage: (page) => set({ page }),
  toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen })),
  showPINModal: (name, pin) => set({ modalOpen: true, modalPIN: pin, modalOlympiadName: name }),
  closePINModal: () => set({ modalOpen: false, modalPIN: '', modalOlympiadName: '' })
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
    return <div className="olympiad-badge">{selectedOlympiad}</div>
  }
}

function PINModal() {
  const { modalOpen, modalPIN, modalOlympiadName, closePINModal } = useUIStore()

  if (!modalOpen) return null

  return (
    <div className="modal-overlay" onClick={closePINModal}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Olimpiade Creata!</h2>
        <p className="modal-olympiad-name">{modalOlympiadName}</p>
        <div className="modal-pin-section">
          <p>Il tuo PIN di accesso:</p>
          <div className="modal-pin">{modalPIN}</div>
        </div>
        <p className="modal-warning">Conserva questo PIN! Ti servira per modificare l'olimpiade.</p>
        <button className="modal-ok-button" onClick={closePINModal}>
          OK
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const { page } = useUIStore()
  const { fetchOlympiads } = useDataStore()

  useEffect(() => {
    fetchOlympiads()
  }, [fetchOlympiads])

  return (
    <div className="app-wrapper">
      <HamburgerButton />
      <SideMenu />
      <PINModal />
      <main className="page-content">
        <div className="olympiad-bar">
          <OlympiadBadge />
        </div>
        {page === Page.EVENTS && <Events />}
        {page === Page.PLAYERS && <Players />}
        {page === Page.OLYMPIAD && <Olympiads />}
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

  return (
    <nav className={`side-menu ${menuOpen ? 'open' : ''}`}>
      <button
        className={`menu-item ${page === Page.OLYMPIAD ? 'active' : ''}`}
        onClick={() => setMainPage(Page.OLYMPIAD)}
      >
        Olimpiadi
      </button>
      <button
        className={`menu-item ${page === Page.EVENTS ? 'active' : ''}`}
        onClick={() => setMainPage(Page.EVENTS)}
      >
        Eventi
      </button>
      <button
        className={`menu-item ${page === Page.PLAYERS ? 'active' : ''}`}
        onClick={() => setMainPage(Page.PLAYERS)}
      >
        Giocatori
      </button>
    </nav>
  )
}

interface ItemButtonProps {
  label: string
  color: ColorScheme
  onClick?: () => void
  onRename?: (newName: string) => void
  onDelete?: () => void
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
    if (trimmed && trimmed !== label && onRename) {
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
    if (onDelete) {
      onDelete()
    }
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
      {(onRename || onDelete) && (
        <div className="item-actions">
          {onRename && (
            <button className="item-action-btn rename-btn" onClick={handleRenameClick} title="Rinomina">
              <span className="icon-pencil"></span>
            </button>
          )}
          {onDelete && (
            <button className="item-action-btn delete-btn" onClick={handleDeleteClick} title="Elimina">
              <span className="icon-trash"></span>
            </button>
          )}
        </div>
      )}
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
  const {
    olympiads,
    // selectedOlympiad,
    // selectedOlympiadData,
    selectOlympiad,
    createOlympiad,
    renameOlympiad,
    deleteOlympiad
  } = useDataStore()
  const { showPINModal, setMainPage } = useUIStore()

  const handleCreateOlympiad = async (name: string) => {
    try {
      const data = await createOlympiad(name)
      showPINModal(data.name, data.pin)
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const handleSelectOlympiad = (name: string) => {
    selectOlympiad(name)
    setMainPage(Page.EVENTS)
  }

  const handleRename = async (oldName: string, newName: string, version: number) => {
    try {
      await renameOlympiad(oldName, newName, version)
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const handleDelete = async (name: string) => {
    if (!confirm(`Sei sicuro di voler eliminare "${name}"?`)) return
    try {
      await deleteOlympiad(name)
    } catch (err) {
      alert((err as Error).message)
    }
  }

  return (
    <div className="app-container">
      <AddItemInput placeholder="Nuova olimpiade..." onAdd={handleCreateOlympiad} />
      <div className="items-list">
        {olympiads.map((olympiad, i) => (
          <ItemButton
            key={olympiad.name}
            label={olympiad.name}
            color={COLORS[i % COLORS.length]}
            onClick={() => handleSelectOlympiad(olympiad.name)}
            onRename={(newName) => handleRename(olympiad.name, newName, olympiad.version)}
            onDelete={() => handleDelete(olympiad.name)}
          />
        ))}
      </div>
    </div>
  )
}

// Events Component
function Events() {
  const { selectedOlympiad, selectedOlympiadData, createTournament, renameTournament, deleteTournament } =
    useDataStore()

  if (!selectedOlympiad) {
    return (
      <div className="app-container">
        <p className="empty-message">Seleziona un'olimpiade per vedere gli eventi</p>
      </div>
    )
  }

  const tournaments = selectedOlympiadData?.tournaments || []

  const handleAddTournament = async (name: string) => {
    try {
      await createTournament(name, 'round_robin')
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const handleRename = async (tournament: TournamentResponse, newName: string) => {
    try {
      await renameTournament(tournament.id, newName, tournament.version)
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const handleDelete = async (tournament: TournamentResponse) => {
    if (!confirm(`Sei sicuro di voler eliminare "${tournament.name}"?`)) return
    try {
      await deleteTournament(tournament.id)
    } catch (err) {
      alert((err as Error).message)
    }
  }

  return (
    <div className="app-container">
      <AddItemInput placeholder="Nuovo evento..." onAdd={handleAddTournament} />
      <div className="items-list">
        {tournaments.map((tournament, i) => (
          <ItemButton
            key={tournament.id}
            label={tournament.name}
            color={COLORS[i % COLORS.length]}
            onRename={(newName) => handleRename(tournament, newName)}
            onDelete={() => handleDelete(tournament)}
          />
        ))}
      </div>
    </div>
  )
}

// Players Component
function Players() {
  const { selectedOlympiad, selectedOlympiadData, createPlayer, renamePlayer, deletePlayer } =
    useDataStore()

  if (!selectedOlympiad) {
    return (
      <div className="app-container">
        <p className="empty-message">Seleziona un'olimpiade per vedere i giocatori</p>
      </div>
    )
  }

  const players = selectedOlympiadData?.players || []

  const handleAddPlayer = async (name: string) => {
    try {
      await createPlayer(name)
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const handleRename = async (player: PlayerResponse, newName: string) => {
    try {
      await renamePlayer(player.id, newName, player.version)
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const handleDelete = async (player: PlayerResponse) => {
    if (!confirm(`Sei sicuro di voler eliminare "${player.name}"?`)) return
    try {
      await deletePlayer(player.id)
    } catch (err) {
      alert((err as Error).message)
    }
  }

  return (
    <div className="app-container">
      <AddItemInput placeholder="Nuovo giocatore..." onAdd={handleAddPlayer} />
      <div className="items-list">
        {players.map((player, i) => (
          <ItemButton
            key={player.id}
            label={player.name}
            color={COLORS[i % COLORS.length]}
            onRename={(newName) => handleRename(player, newName)}
            onDelete={() => handleDelete(player)}
          />
        ))}
      </div>
    </div>
  )
}

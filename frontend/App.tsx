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
  id: number
  name: string
  version: number
}

interface OlympiadResponse {
  id: number
  name: string
  pin: string
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
  tournaments: TournamentResponse[]
  selectedTournament: TournamentResponse | null
  loading: boolean
  error: string | null

  // Setters
  setOlympiads: (olympiads: OlympiadSummary[]) => void
  setPlayers: (players: PlayerResponse[]) => void
  setTournaments: (tournaments: TournamentResponse[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  selectOlympiad: (id: number) => void
  clearSelectedOlympiad: () => void
  selectPlayer: (id: number) => void
  clearSelectedPlayer: () => void
  selectTournament: (id: number) => void
  clearSelectedTournament: () => void
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
  infoModalOpen: boolean
  infoModalTitle: string
  infoModalMessage: string

  // PIN input modal state
  pinInputModalOpen: boolean
  pinInputOlympiadId: number | null
  pinInputOlympiadName: string
  pinInputError: string | null
  pinInputCallback: (() => void) | null

  setMainPage: (page: Page) => void
  toggleMenu: () => void
  showPINModal: (name: string, pin: string) => void
  closePINModal: () => void
  showInfoModal: (title: string, message: string) => void
  closeInfoModal: () => void
  showPINInputModal: (olympiadId: number, olympiadName: string, callback: () => void) => void
  closePINInputModal: () => void
  setPINInputError: (error: string | null) => void
}

// localStorage helpers for PIN storage (keyed by olympiad ID)
function savePIN(olympiadId: number, pin: string) {
  const pins = JSON.parse(localStorage.getItem('olympiadPINs') || '{}')
  pins[olympiadId] = pin
  localStorage.setItem('olympiadPINs', JSON.stringify(pins))
}

function getPIN(olympiadId: number): string | null {
  const pins = JSON.parse(localStorage.getItem('olympiadPINs') || '{}')
  return pins[olympiadId] || null
}

// ============================================
// API LAYER - thin fetch wrappers
// ============================================
const api = {
  // Olympiad endpoints
  getOlympiads: (): Promise<Response> =>
    fetch(`${API_BASE}/olympiads`),

  createOlympiad: (name: string): Promise<Response> =>
    fetch(`${API_BASE}/olympiads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    }),

  renameOlympiad: (olympiadId: number, name: string, version: number): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, version })
    }),

  deleteOlympiad: (olympiadId: number): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}`, { method: 'DELETE' }),

  // Player endpoints
  getPlayers: (olympiadId: number): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/players`),

  createPlayer: (olympiadId: number, name: string): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    }),

  renamePlayer: (olympiadId: number, playerId: number, name: string, version: number): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/players/${playerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, version })
    }),

  deletePlayer: (olympiadId: number, playerId: number): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/players/${playerId}`, { method: 'DELETE' }),

  // Tournament endpoints
  getTournaments: (olympiadId: number): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/tournaments`),

  createTournament: (olympiadId: number, name: string, type: TournamentResponse['type']): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/tournaments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type })
    }),

  renameTournament: (olympiadId: number, tournamentId: number, name: string, version: number): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/tournaments/${tournamentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, version })
    }),

  deleteTournament: (olympiadId: number, tournamentId: number): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/tournaments/${tournamentId}`, { method: 'DELETE' }),

  // PIN verification
  verifyPIN: (olympiadId: number, pin: string): Promise<Response> =>
    fetch(`${API_BASE}/olympiads/${olympiadId}/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    })
}

// ============================================
// DATA STORE IMPLEMENTATION
// ============================================
const useDataStore = create<DataStore>((set, get) => ({
  olympiads: [],
  players: [],
  selectedPlayer: null,
  tournaments: [],
  selectedTournament: null,
  selectedOlympiad: null,
  loading: false,
  error: null,

  setOlympiads: (olympiads) => set({ olympiads }),
  setPlayers: (players) => set({ players }),
  setTournaments: (tournaments) => set({ tournaments }),
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

  selectTournament: (id) => {
    const tournament = get().tournaments.find((t) => t.id === id) || null
    set({ selectedTournament: tournament })
  },

  clearSelectedTournament: () => {
    set({ selectedTournament: null })
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
  infoModalOpen: false,
  infoModalTitle: '',
  infoModalMessage: '',
  pinInputModalOpen: false,
  pinInputOlympiadId: null,
  pinInputOlympiadName: '',
  pinInputError: null,
  pinInputCallback: null,

  setMainPage: (page) => set({ page }),
  toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen })),
  showPINModal: (name, pin) => set({ modalOpen: true, modalPIN: pin, modalOlympiadName: name }),
  closePINModal: () => set({ modalOpen: false, modalPIN: '', modalOlympiadName: '' }),
  showInfoModal: (title, message) => set({ infoModalOpen: true, infoModalTitle: title, infoModalMessage: message }),
  closeInfoModal: () => set({ infoModalOpen: false, infoModalTitle: '', infoModalMessage: '' }),
  showPINInputModal: (olympiadId, olympiadName, callback) => set({
    pinInputModalOpen: true,
    pinInputOlympiadId: olympiadId,
    pinInputOlympiadName: olympiadName,
    pinInputCallback: callback,
    pinInputError: null
  }),
  closePINInputModal: () => set({
    pinInputModalOpen: false,
    pinInputOlympiadId: null,
    pinInputOlympiadName: '',
    pinInputCallback: null,
    pinInputError: null
  }),
  setPINInputError: (error) => set({ pinInputError: error })
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

function PINInputModal() {
  const {
    pinInputModalOpen,
    pinInputOlympiadId,
    pinInputOlympiadName,
    pinInputError,
    pinInputCallback,
    closePINInputModal,
    setPINInputError
  } = useUIStore()
  const [pinValue, setPinValue] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)

  if (!pinInputModalOpen || !pinInputOlympiadId) return null

  const handleSubmit = async () => {
    if (!pinValue.trim()) return

    setIsVerifying(true)
    setPINInputError(null)

    const res = await api.verifyPIN(pinInputOlympiadId, pinValue.trim())
    if (res.ok) {
      const data: { valid: boolean } = await res.json()
      if (data.valid) {
        savePIN(pinInputOlympiadId, pinValue.trim())
        closePINInputModal()
        setPinValue('')
        if (pinInputCallback) {
          pinInputCallback()
        }
      } else {
        setPINInputError('PIN non corretto')
      }
    } else {
      setPINInputError('Errore durante la verifica del PIN')
    }
    setIsVerifying(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Escape') {
      closePINInputModal()
      setPinValue('')
    }
  }

  const handleClose = () => {
    closePINInputModal()
    setPinValue('')
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Inserisci PIN</h2>
        <p className="modal-olympiad-name">{pinInputOlympiadName}</p>
        <p>Per modificare questa olimpiade devi inserire il PIN di amministrazione.</p>
        <input
          type="text"
          className="pin-input"
          placeholder="PIN"
          value={pinValue}
          onChange={(e) => setPinValue(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={4}
          autoFocus
        />
        {pinInputError && <p className="pin-error">{pinInputError}</p>}
        <div className="modal-buttons">
          <button className="modal-cancel-button" onClick={handleClose} disabled={isVerifying}>
            Annulla
          </button>
          <button className="modal-ok-button" onClick={handleSubmit} disabled={isVerifying}>
            {isVerifying ? 'Verifica...' : 'Conferma'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const { page } = useUIStore()
  const { selectedTournament, selectedPlayer } = useDataStore()

  return (
    <div className="app-wrapper">
      <HamburgerButton />
      <SideMenu />
      <PINModal />
      <InfoModal />
      <PINInputModal />
      <main className="page-content">
        <div className="olympiad-bar">
          <OlympiadBadge />
        </div>
        {page === Page.OLYMPIAD && <Olympiads />}
        {page === Page.EVENTS && (selectedTournament ? <EventDetail /> : <Events />)}
        {page === Page.PLAYERS && (selectedPlayer ? <PlayerDetail /> : <Players />)}
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
  const { clearSelectedPlayer, clearSelectedTournament } = useDataStore()

  const handleNavigation = (targetPage: Page) => {
    clearSelectedPlayer()
    clearSelectedTournament()
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
  const { showPINModal, showInfoModal, showPINInputModal } = useUIStore()

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

  const handleCreate = async (name: string) => {
    const res = await api.createOlympiad(name)
    if (!res.ok) {
      const error: { detail?: string } = await res.json()
      showInfoModal('Errore', (error.detail || 'Impossibile creare l\'olimpiade') + '\n\nLa lista è stata aggiornata con dati più recenti')
      fetchOlympiads()
      return
    }
    const data: OlympiadResponse = await res.json()
    savePIN(data.id, data.pin)
    showPINModal(data.name, data.pin)
    fetchOlympiads()
  }

  const doRename = async (olympiadId: number, newName: string, version: number) => {
    const res = await api.renameOlympiad(olympiadId, newName, version)
    if (!res.ok) {
      const error: { detail?: string } = await res.json()
      if (res.status === 409) {
        showInfoModal('Conflitto', 'Questa olimpiade è stata modificata da un altro utente.')
      } else {
        showInfoModal('Errore', error.detail || 'Impossibile rinominare l\'olimpiade')
      }
    }
    fetchOlympiads()
  }

  const handleRename = (olympiad: OlympiadSummary, newName: string) => {
    if (getPIN(olympiad.id)) {
      doRename(olympiad.id, newName, olympiad.version)
    } else {
      showPINInputModal(olympiad.id, olympiad.name, () => doRename(olympiad.id, newName, olympiad.version))
    }
  }

  const doDelete = async (olympiadId: number) => {
    const res = await api.deleteOlympiad(olympiadId)
    if (!res.ok) {
      const error: { detail?: string } = await res.json()
      showInfoModal('Errore', error.detail || 'Impossibile eliminare l\'olimpiade')
    }
    fetchOlympiads()
  }

  const handleDelete = (olympiad: OlympiadSummary) => {
    if (!confirm(`Sei sicuro di voler eliminare "${olympiad.name}"?`)) return
    if (getPIN(olympiad.id)) {
      doDelete(olympiad.id)
    } else {
      showPINInputModal(olympiad.id, olympiad.name, () => doDelete(olympiad.id))
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
  const { selectedOlympiad, tournaments, setTournaments, clearSelectedOlympiad, setOlympiads, selectTournament } = useDataStore()
  const { setMainPage, showInfoModal, showPINInputModal } = useUIStore()

  const handleSelect = (tournamentId: number) => {
    selectTournament(tournamentId)
  }

  const fetchTournaments = async () => {
    if (!selectedOlympiad) return
    const res = await api.getTournaments(selectedOlympiad.id)
    if (res.ok) {
      const data: TournamentResponse[] = await res.json()
      setTournaments(data)
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
      fetchTournaments()
    }
  }, [selectedOlympiad])

  if (!selectedOlympiad) {
    return (
      <div className="app-container">
        <p className="empty-message">Seleziona un'olimpiade per vedere gli eventi</p>
      </div>
    )
  }

  const doCreate = async (name: string) => {
    const res = await api.createTournament(selectedOlympiad.id, name, 'round_robin')
    if (!res.ok) {
      const error: { detail?: string } = await res.json()
      if (res.status === 404) {
        clearSelectedOlympiad()
        setMainPage(Page.OLYMPIAD)
        showInfoModal('Olimpiade non trovata', 'Questa olimpiade è stata eliminata da un altro utente.')
        const olympiadsRes = await api.getOlympiads()
        if (olympiadsRes.ok) {
          setOlympiads(await olympiadsRes.json())
        }
      } else {
        showInfoModal('Errore', (error.detail || 'Impossibile creare l\'evento') + '\n\nLa lista è stata aggiornata con dati più recenti')
        fetchTournaments()
      }
      return
    }
    fetchTournaments()
  }

  const handleCreate = (name: string) => {
    if (getPIN(selectedOlympiad.id)) {
      doCreate(name)
    } else {
      showPINInputModal(selectedOlympiad.id, selectedOlympiad.name, () => doCreate(name))
    }
  }

  const doRename = async (tournament: TournamentResponse, newName: string) => {
    const res = await api.renameTournament(selectedOlympiad.id, tournament.id, newName, tournament.version)
    if (!res.ok) {
      const error: { detail?: string } = await res.json()
      if (res.status === 409) {
        showInfoModal('Conflitto', 'Questo evento è stato modificato da un altro utente.')
      } else {
        showInfoModal('Errore', error.detail || 'Impossibile rinominare l\'evento')
      }
    }
    fetchTournaments()
  }

  const handleRename = (tournament: TournamentResponse, newName: string) => {
    if (getPIN(selectedOlympiad.id)) {
      doRename(tournament, newName)
    } else {
      showPINInputModal(selectedOlympiad.id, selectedOlympiad.name, () => doRename(tournament, newName))
    }
  }

  const doDelete = async (tournament: TournamentResponse) => {
    const res = await api.deleteTournament(selectedOlympiad.id, tournament.id)
    if (!res.ok) {
      const error: { detail?: string } = await res.json()
      showInfoModal('Errore', error.detail || 'Impossibile eliminare l\'evento')
    }
    fetchTournaments()
  }

  const handleDelete = (tournament: TournamentResponse) => {
    if (!confirm(`Sei sicuro di voler eliminare "${tournament.name}"?`)) return
    if (getPIN(selectedOlympiad.id)) {
      doDelete(tournament)
    } else {
      showPINInputModal(selectedOlympiad.id, selectedOlympiad.name, () => doDelete(tournament))
    }
  }

  return (
    <div className="app-container">
      <AddItemInput placeholder="Nuovo evento..." onAdd={handleCreate} />
      <div className="items-list">
        {tournaments.map((tournament: TournamentResponse, i: number) => (
          <ItemButton
            key={tournament.id}
            label={tournament.name}
            color={COLORS[i % COLORS.length]}
            onClick={() => handleSelect(tournament.id)}
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
  const { selectedOlympiad, players, setPlayers, clearSelectedOlympiad, setOlympiads, selectPlayer } = useDataStore()
  const { setMainPage, showInfoModal, showPINInputModal } = useUIStore()

  const handleSelect = (playerId: number) => {
    selectPlayer(playerId)
  }

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

  const doCreate = async (name: string) => {
    const res = await api.createPlayer(selectedOlympiad.id, name)
    if (!res.ok) {
      const error: { detail?: string } = await res.json()
      if (res.status === 404) {
        clearSelectedOlympiad()
        setMainPage(Page.OLYMPIAD)
        showInfoModal('Olimpiade non trovata', 'Questa olimpiade è stata eliminata da un altro utente.')
        const olympiadsRes = await api.getOlympiads()
        if (olympiadsRes.ok) {
          setOlympiads(await olympiadsRes.json())
        }
      } else {
        showInfoModal('Errore', (error.detail || 'Impossibile creare il giocatore') + '\n\nLa lista è stata aggiornata con dati più recenti')
        fetchPlayers()
      }
      return
    }
    fetchPlayers()
  }

  const handleCreate = (name: string) => {
    if (getPIN(selectedOlympiad.id)) {
      doCreate(name)
    } else {
      showPINInputModal(selectedOlympiad.id, selectedOlympiad.name, () => doCreate(name))
    }
  }

  const doRename = async (player: PlayerResponse, newName: string) => {
    const res = await api.renamePlayer(selectedOlympiad.id, player.id, newName, player.version)
    if (!res.ok) {
      const error: { detail?: string } = await res.json()
      if (res.status === 409) {
        showInfoModal('Conflitto', 'Questo giocatore è stato modificato da un altro utente.')
      } else {
        showInfoModal('Errore', error.detail || 'Impossibile rinominare il giocatore')
      }
    }
    fetchPlayers()
  }

  const handleRename = (player: PlayerResponse, newName: string) => {
    if (getPIN(selectedOlympiad.id)) {
      doRename(player, newName)
    } else {
      showPINInputModal(selectedOlympiad.id, selectedOlympiad.name, () => doRename(player, newName))
    }
  }

  const doDelete = async (player: PlayerResponse) => {
    const res = await api.deletePlayer(selectedOlympiad.id, player.id)
    if (!res.ok) {
      const error: { detail?: string } = await res.json()
      showInfoModal('Errore', error.detail || 'Impossibile eliminare il giocatore')
    }
    fetchPlayers()
  }

  const handleDelete = (player: PlayerResponse) => {
    if (!confirm(`Sei sicuro di voler eliminare "${player.name}"?`)) return
    if (getPIN(selectedOlympiad.id)) {
      doDelete(player)
    } else {
      showPINInputModal(selectedOlympiad.id, selectedOlympiad.name, () => doDelete(player))
    }
  }

  return (
    <div className="app-container">
      <AddItemInput placeholder="Nuovo giocatore..." onAdd={handleCreate} />
      <div className="items-list">
        {players.map((player: PlayerResponse, i: number) => (
          <ItemButton
            key={player.id}
            label={player.name}
            color={COLORS[i % COLORS.length]}
            onClick={() => handleSelect(player.id)}
            onRename={(newName) => handleRename(player, newName)}
            onDelete={() => handleDelete(player)}
          />
        ))}
      </div>
    </div>
  )
}

// Event Detail Component
function EventDetail() {
  const { selectedTournament, clearSelectedTournament } = useDataStore()

  // TODO: query to fetch all the events info that we need to render up-to-date info on the tournament

  return (
    <div className="app-container">
      <button className="back-button" onClick={clearSelectedTournament}>← Torna agli eventi</button>
      <h2 className="detail-title">{selectedTournament!.name}</h2>
      <p>Tipo: {selectedTournament!.type}</p>
      <p>Stato: {selectedTournament!.status}</p>
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

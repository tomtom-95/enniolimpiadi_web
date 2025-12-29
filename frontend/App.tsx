import { useState, useEffect } from 'react'
import { create } from 'zustand'
import './App.css'

// Use the same hostname as the frontend, but port 8000 for the API
const API_BASE = `http://${window.location.hostname}:8000`

// Enums
enum Page {
  OLYMPIAD = 'olympiad',
  EVENTS   = 'events',
  PLAYERS  = 'players'
}

// Types
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
  olympiads:        string[]
  events:           string[]
  players:          string[]
  selectedEvent:    string
  selectedPlayer:   string
  selectedOlympiad: string

  selectOlympiad: (name: string) => void
  selectEvent: (name: string) => void
  selectPlayer: (name: string) => void
  addOlympiad: (name: string) => void
  addEvent: (name: string) => void
  addPlayer: (name: string) => void
  setOlympiads: (olympiads: string[]) => void
  createOlympiad: (name: string) => Promise<{ name: string, pin: string }>
  renameOlympiad: (oldName: string, newName: string) => void
  deleteOlympiad: (name: string) => void
  renameEvent: (oldName: string, newName: string) => void
  deleteEvent: (name: string) => void
  renamePlayer: (oldName: string, newName: string) => void
  deletePlayer: (name: string) => void
}

// ============================================
// UI STORE - navigation and rendering state
// ============================================
interface UIStore {
  page:             Page
  menuOpen:         boolean
  modalOpen:        boolean
  modalPIN:         string
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
const useDataStore = create<DataStore>((set) => ({
  olympiads:      ["NoOlympiad"],
  events:         ["NoEvent", "Ping Pong", "Machiavelli", "Scopone", "Monopoli"],
  players: [
    "NoPlayer",
    "Marco",
    "Luca",
    "Giulia",
    "Sara",
    "Player01",
    "Player02",
    "Player03",
    "Player04",
    "Player05",
    "Player06",
    "Player07",
    "Player08",
    "Player09",
    "Player10",
    "Player11",
    "Player12"
  ],
  selectedEvent:    "NoEvent",
  selectedPlayer:   "NoPlayer",
  selectedOlympiad: "NoOlympiad",

  selectOlympiad: (name) => set({ selectedOlympiad: name }),
  selectEvent: (name) => set({ selectedEvent: name }),
  selectPlayer: (name) => set({ selectedPlayer: name }),
  addOlympiad: (name) => set((s) => ({ olympiads: [...s.olympiads, name] })),
  addEvent: (name) => set((s) => ({ events: [...s.events, name] })),
  addPlayer: (name) => set((s) => ({ players: [...s.players, name] })),
  setOlympiads: (olympiads) => set({ olympiads: ["NoOlympiad", ...olympiads] }),
  createOlympiad: async (name) => {
    const res = await fetch(`${API_BASE}/olympiads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    const data = await res.json()
    savePIN(data.name, data.pin)
    set((s) => ({ olympiads: [...s.olympiads, data.name] }))
    return data
  },
  renameOlympiad: (oldName, newName) => set((s) => ({
    olympiads: s.olympiads.map(o => o === oldName ? newName : o),
    selectedOlympiad: s.selectedOlympiad === oldName ? newName : s.selectedOlympiad
  })),
  deleteOlympiad: (name) => set((s) => ({
    olympiads: s.olympiads.filter(o => o !== name),
    selectedOlympiad: s.selectedOlympiad === name ? "NoOlympiad" : s.selectedOlympiad
  })),
  renameEvent: (oldName, newName) => set((s) => ({
    events: s.events.map(e => e === oldName ? newName : e),
    selectedEvent: s.selectedEvent === oldName ? newName : s.selectedEvent
  })),
  deleteEvent: (name) => set((s) => ({
    events: s.events.filter(e => e !== name),
    selectedEvent: s.selectedEvent === name ? "NoEvent" : s.selectedEvent
  })),
  renamePlayer: (oldName, newName) => set((s) => ({
    players: s.players.map(p => p === oldName ? newName : p),
    selectedPlayer: s.selectedPlayer === oldName ? newName : s.selectedPlayer
  })),
  deletePlayer: (name) => set((s) => ({
    players: s.players.filter(p => p !== name),
    selectedPlayer: s.selectedPlayer === name ? "NoPlayer" : s.selectedPlayer
  }))
}))

// ============================================
// UI STORE IMPLEMENTATION
// ============================================
const useUIStore = create<UIStore>((set) => ({
  page:             Page.EVENTS,
  menuOpen:         false,
  modalOpen:        false,
  modalPIN:         "",
  modalOlympiadName: "",

  setMainPage: (page) => set({ page }),
  toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen })),
  showPINModal: (name, pin) => set({ modalOpen: true, modalPIN: pin, modalOlympiadName: name }),
  closePINModal: () => set({ modalOpen: false, modalPIN: "", modalOlympiadName: "" })
}))

// Colors for buttons
const COLORS: ColorScheme[] = [
  { bg: '#e85d4c', text: '#fff',    hoverBg: '#c94a3a', hoverText: '#fff' },
  { bg: '#5bc0be', text: '#2d2a4a', hoverBg: '#45a3a1', hoverText: '#fff' },
  { bg: '#ffb347', text: '#2d2a4a', hoverBg: '#e99d33', hoverText: '#2d2a4a' },
  { bg: '#a78bfa', text: '#fff',    hoverBg: '#8b6fe0', hoverText: '#fff' },
  { bg: '#ff6b6b', text: '#fff',    hoverBg: '#e55a5a', hoverText: '#fff' },
  { bg: '#4ecdc4', text: '#2d2a4a', hoverBg: '#3dbdb5', hoverText: '#fff' },
  { bg: '#ffe66d', text: '#2d2a4a', hoverBg: '#f5dc5d', hoverText: '#2d2a4a' },
  { bg: '#95e1d3', text: '#2d2a4a', hoverBg: '#7ed3c4', hoverText: '#2d2a4a' },
  { bg: '#dcd6f7', text: '#2d2a4a', hoverBg: '#c9c1ed', hoverText: '#2d2a4a' },
  { bg: '#f8a5c2', text: '#2d2a4a', hoverBg: '#f593b5', hoverText: '#2d2a4a' }
]

// OlympiadBadge Component
function OlympiadBadge() {
  const { selectedOlympiad } = useDataStore()

  if (selectedOlympiad === "NoOlympiad") {
    return (
      <div className="olympiad-badge empty">
        Nessuna olimpiade
      </div>
    )
  }
  else {
    return (
      <div className="olympiad-badge">
        {selectedOlympiad}
      </div>
    )
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
        <p className="modal-warning">
          Conserva questo PIN! Ti servira per modificare l'olimpiade.
        </p>
        <button className="modal-ok-button" onClick={closePINModal}>
          OK
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const { page } = useUIStore()

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
      <button className={`menu-item ${page === Page.OLYMPIAD ? 'active' : ''}`} onClick={() => setMainPage(Page.OLYMPIAD)}>Olimpiadi</button>
      <button className={`menu-item ${page === Page.EVENTS   ? 'active' : ''}`} onClick={() => setMainPage(Page.EVENTS)}>Eventi</button>
      <button className={`menu-item ${page === Page.PLAYERS  ? 'active' : ''}`} onClick={() => setMainPage(Page.PLAYERS)}>Giocatori</button>
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
    // TODO: when handleSubmit run I must set the variable that triggers a modal window for the
    //       tournament just created
    //       I would say that I need a boolean isModalRegisterEvent and I can use selectedEvent
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
  const { olympiads, selectOlympiad, createOlympiad, setOlympiads, renameOlympiad, deleteOlympiad } = useDataStore()
  const { showPINModal } = useUIStore()

  useEffect(() => {
    fetch(`${API_BASE}/olympiads`)
      .then(res => res.json())
      .then(data => setOlympiads(data))
      .catch(err => console.error('Failed to fetch olympiads:', err))
  }, [setOlympiads])

  const handleCreateOlympiad = async (name: string) => {
    const data = await createOlympiad(name)
    showPINModal(data.name, data.pin)
  }

  return (
    <div className="app-container">
      <AddItemInput placeholder="Nuova olimpiade..." onAdd={handleCreateOlympiad} />
      <div className="items-list">
        {olympiads.slice(1).map((olympiad, i) => (
          <ItemButton
            key={i}
            label={olympiad}
            color={COLORS[i % COLORS.length]}
            onClick={() => selectOlympiad(olympiad)}
            onRename={(newName) => renameOlympiad(olympiad, newName)}
            onDelete={() => deleteOlympiad(olympiad)}
          />
        ))}
      </div>
    </div>
  )
}

// Events Component
function Events() {
  const { events, selectEvent, addEvent, renameEvent, deleteEvent } = useDataStore()

  return (
    <div className="app-container">
      <AddItemInput placeholder="Nuovo evento..." onAdd={addEvent} />
      <div className="items-list">
        {events.slice(1).map((event, i) => (
          <ItemButton
            key={i}
            label={event}
            color={COLORS[i % COLORS.length]}
            onClick={() => selectEvent(event)}
            onRename={(newName) => renameEvent(event, newName)}
            onDelete={() => deleteEvent(event)}
          />
        ))}
      </div>
    </div>
  )
}

// Players Component
function Players() {
  const { players, selectPlayer, addPlayer, renamePlayer, deletePlayer } = useDataStore()

  return (
    <div className="app-container">
      <AddItemInput placeholder="Nuovo giocatore..." onAdd={addPlayer} />
      <div className="items-list">
        {players.slice(1).map((player, i) => (
          <ItemButton
            key={i}
            label={player}
            color={COLORS[i % COLORS.length]}
            onClick={() => selectPlayer(player)}
            onRename={(newName) => renamePlayer(player, newName)}
            onDelete={() => deletePlayer(player)}
          />
        ))}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { create } from 'zustand'
import './App.css'

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
// ZUSTAND STORE - all state lives here
// ============================================
interface AppStore {
  page:             Page
  menuOpen:         boolean
  olympiads:        string[]
  events:           string[]
  players:          string[]
  selectedEvent:    string
  selectedPlayer:   string
  selectedOlympiad: string
  setMainPage: (page: Page) => void
  setPlayerPage: (selectedPlayer: string) => void
  setEventPage: (selectedEvent: string) => void
  setOlympiadPage: (selectedOlympiad: string) => void
  toggleMenu: () => void
  setSelectedEvent: (selectedEvent: string) => void
  addOlympiad: (name: string) => void
  addEvent: (name: string) => void
  addPlayer: (name: string) => void
}

const useAppStore = create<AppStore>((set) => ({
  page:           Page.EVENTS,
  menuOpen:       false,
  olympiads:      ["NoOlympiad", "Enniolimpiadi2025", "Enniolimpiadi2026"],
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
  selectedEvent:  "NoEvent",
  selectedPlayer: "NoPlayer",
  selectedOlympiad: "NoOlympiad",
  setMainPage: (page) => set({ page }),
  setPlayerPage: (selectedPlayer) => set({ selectedPlayer }),
  setEventPage: (selectedEvent) => set({ selectedEvent }),
  setOlympiadPage: (selectedOlympiad) => set({ selectedOlympiad }),
  toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen })),
  setSelectedEvent: (selectedEvent) => set({ selectedEvent }),
  addOlympiad: (name) => set((s) => ({ olympiads: [...s.olympiads, name] })),
  addEvent: (name) => set((s) => ({ events: [...s.events, name] })),
  addPlayer: (name) => set((s) => ({ players: [...s.players, name] }))
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

export default function App() {
  const { page, menuOpen } = useAppStore()

  return (
    <div className="app-wrapper">
      {!menuOpen && <header className="top-bar" />}
      <HamburgerButton />
      <SideMenu />
      <main className="page-content">
        {page === Page.EVENTS && <Events />}
        {page === Page.PLAYERS && <Players />}
        {page === Page.OLYMPIAD && <Olympiads />}
      </main>
    </div>
  )
}

// HamburgerButton Component
function HamburgerButton() {
  const { menuOpen, toggleMenu } = useAppStore()

  return (
    <button className={`hamburger ${menuOpen ? 'open' : ''}`} onClick={toggleMenu}>
      <span></span>
      <span></span>
      <span></span>
    </button>
  )
}

// SideMenu Component
function SideMenu() {
  const { page, menuOpen, setMainPage } = useAppStore()

  return (
    <nav className={`side-menu ${menuOpen ? 'open' : ''}`}>
      <button className={`menu-item ${page === Page.OLYMPIAD ? 'active' : ''}`} onClick={() => setMainPage(Page.OLYMPIAD)}>Olimpiadi</button>
      <button className={`menu-item ${page === Page.EVENTS   ? 'active' : ''}`} onClick={() => setMainPage(Page.EVENTS)}>Eventi</button>
      <button className={`menu-item ${page === Page.PLAYERS  ? 'active' : ''}`} onClick={() => setMainPage(Page.PLAYERS)}>Giocatori</button>
    </nav>
  )
}

// ItemButton Component
interface ItemButtonProps {
  label: string
  color: ColorScheme
  onClick?: () => void
}

function ItemButton({ label, color, onClick }: ItemButtonProps) {
  const [hovered, setHovered] = useState(false)

  const style = {
    backgroundColor: hovered ? color.hoverBg : color.bg,
    color: hovered ? color.hoverText : color.text
  }

  return (
    <button
      className="item-button"
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

// AddItemInput Component
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
  const { olympiads, setOlympiadPage, addOlympiad } = useAppStore()

  return (
    <div className="app-container">
      <AddItemInput placeholder="Nuova olimpiade..." onAdd={addOlympiad} />
      <div className="items-list">
        {olympiads.slice(1).map((olympiad, i) => (
          <ItemButton
            key={i}
            label={olympiad}
            color={COLORS[i % COLORS.length]}
            onClick={() => setOlympiadPage(olympiad)}
          />
        ))}
      </div>
    </div>
  )
}

// Events Component
function Events() {
  const { events, setEventPage, addEvent } = useAppStore()

  return (
    <div className="app-container">
      <AddItemInput placeholder="Nuovo evento..." onAdd={addEvent} />
      <div className="items-list">
        {events.slice(1).map((event, i) => (
          <ItemButton
            key={i}
            label={event}
            color={COLORS[i % COLORS.length]}
            onClick={() => setEventPage(event)}
          />
        ))}
      </div>
    </div>
  )
}

// Players Component
function Players() {
  const { players, setPlayerPage, addPlayer } = useAppStore()

  return (
    <div className="app-container">
      <AddItemInput placeholder="Nuovo giocatore..." onAdd={addPlayer} />
      <div className="items-list">
        {players.slice(1).map((player, i) => (
          <ItemButton
            key={i}
            label={player}
            color={COLORS[i % COLORS.length]}
            onClick={() => setPlayerPage(player)}
          />
        ))}
      </div>
    </div>
  )
}

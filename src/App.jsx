import { useState } from 'react'
import './App.css'

// Enums
const Page = {
  EVENTS: 'events',
  PLAYERS: 'players'
}

// Data
const DATA = {
  events: ["Ping Pong", "Machiavelli", "Scopone", "Monopoli"],
  players: ["Marco", "Luca", "Giulia", "Sara", "Andrea", "Chiara"]
}

// Colors for buttons
const COLORS = [
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

// HamburgerButton Component
function HamburgerButton({ state, updateState }) {
  const onClick = () => updateState({ menuOpen: !state.menuOpen })

  return (
    <button className={`hamburger ${state.menuOpen ? 'open' : ''}`} onClick={onClick}>
      <span></span>
      <span></span>
      <span></span>
    </button>
  )
}

// SideMenu Component
function SideMenu({ state, updateState }) {
  const onNavClick = (page) => updateState({ page })

  return (
    <nav className="side-menu">
      <button className={`menu-item ${state.page === Page.EVENTS ? 'active' : ''}`} onClick={() => onNavClick(Page.EVENTS)}>Events</button>
      <button className={`menu-item ${state.page === Page.PLAYERS ? 'active' : ''}`} onClick={() => onNavClick(Page.PLAYERS)}>Players</button>
    </nav>
  )
}

// ItemButton Component
function ItemButton({ label, color, onClick }) {
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

// Events Component
function Events() {
  const onEventClick = (event) => alert(`You clicked: ${event}`)

  return (
    <div className="app-container">
      {DATA.events.map((event, i) => (
        <ItemButton
          key={i}
          label={event}
          color={COLORS[i % COLORS.length]}
          onClick={() => onEventClick(event)}
        />
      ))}
    </div>
  )
}

// Players Component
function Players() {
  const onPlayerClick = (player) => alert(`Player: ${player}`)

  return (
    <div className="app-container">
      {DATA.players.map((player, i) => (
        <ItemButton
          key={i}
          label={player}
          color={COLORS[i % COLORS.length]}
          onClick={() => onPlayerClick(player)}
        />
      ))}
    </div>
  )
}

// App Component
function App() {
  // Global state (single struct)
  const [state, setState] = useState({
    page: Page.EVENTS,
    menuOpen: false
  })

  // State modifier
  const updateState = (changes) => setState(s => ({ ...s, ...changes }))

  return (
    <div className="app-wrapper">

      <HamburgerButton state={state} updateState={updateState} />

      {state.menuOpen && <SideMenu state={state} updateState={updateState} />}

      <main className="page-content">
        {state.page === Page.EVENTS && <Events />}
        {state.page === Page.PLAYERS && <Players />}
      </main>

    </div>
  )
}

export default App

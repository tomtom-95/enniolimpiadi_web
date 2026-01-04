import { useState, useEffect } from 'react'
import './App.css'
import {
  api,
  OlympiadSummary,
  OlympiadCreateResponse,
  PlayerResponse,
  TeamResponse,
  TeamDetail,
  EventResponse,
  EventDetailWithBracket,
  StageKindResponse,
  StageConfig,
  MatchResponse
} from './api'
import { Page, useDataStore, useUIStore, pinStorage } from './stores'

// UI Types
interface ColorScheme {
  bg: string
  text: string
  hoverBg: string
  hoverText: string
}

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
  const {
    showPinModal,
    pinModalPin,
    pinModalOlympiadName,
    closeCreatedPinModal
  } = useUIStore()

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
  const {
    pinInputModalOpen,
    pinInputModalOlympiadId,
    pinInputCallback,
    closePinInputModal
  } = useUIStore()
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
    closeCreateOlympiadModal,
    setCreateOlympiadPin,
    showInfoModal
  } = useUIStore()
  
  const {
    olympiads,
    setOlympiads,
    fetchOlympiads
  } = useDataStore()

  const [error, setError] = useState<string | null>(null)

  if (!createOlympiadModalOpen) {
    return null
  }

  const handleSubmit = async () => {
    setError(null)
    if (createOlympiadPin.length !== 4 || !/^\d{4}$/.test(createOlympiadPin)) {
      setError('Il PIN deve essere di 4 cifre')
    }
    else {
      const res = await api.createOlympiad(createOlympiadName, createOlympiadPin)
      if (res.ok) {
        const data: OlympiadCreateResponse = await res.json()
        pinStorage.setPin(data.id, data.pin)
        setOlympiads([...olympiads, { id: data.id, name: data.name }])
      }
      else {
        const errorData: { detail?: string } = await res.json()
        showInfoModal('Errore', errorData.detail || 'Impossibile creare l\'olimpiade')
        fetchOlympiads()
      }
      closeCreateOlympiadModal()
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

// Create Event Modal - shown when creating a new event with stages
function CreateEventModal() {
  const { 
    createEventModalOpen,
    createEventName,
    createEventCallback,
    closeCreateEventModal
  } = useUIStore()

  const {
    selectedOlympiad
  } = useDataStore()

  const [scoreKind, setScoreKind] = useState<'points' | 'outcome'>('outcome')
  const [stages, setStages] = useState<StageConfig[]>([])
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [availablePlayers, setAvailablePlayers] = useState<PlayerResponse[]>([])
  const [stageKinds, setStageKinds] = useState<StageKindResponse[]>([])

  useEffect(() => {
    if (createEventModalOpen) {
      // Fetch stage kinds
      api.getStageKinds().then(async (res) => {
        if (res.ok) {
          const data: StageKindResponse[] = await res.json()
          setStageKinds(data)
          // Initialize stages with first available kind if empty
          if (data.length > 0 && stages.length === 0) {
            setStages([{ kind: data[0].kind, advance_count: null }])
          }
        }
      })
    }
  }, [createEventModalOpen])

  useEffect(() => {
    if (createEventModalOpen && selectedOlympiad) {
      // Fetch all players (each player has a single-player team with team_id)
      api.getPlayers(selectedOlympiad.id).then(async (res) => {
        if (res.ok) {
          const data: PlayerResponse[] = await res.json()
          setAvailablePlayers(data)
        }
      })
    }
  }, [createEventModalOpen, selectedOlympiad])

  if (!createEventModalOpen) return null

  const handleStageKindChange = (index: number, kind: string) => {
    const newStages = [...stages]
    newStages[index] = { ...newStages[index], kind }
    setStages(newStages)
  }

  const handleAddStage = () => {
    const defaultKind = stageKinds.length > 0 ? stageKinds[0].kind : 'single_elimination'
    setStages([...stages, { kind: defaultKind, advance_count: null }])
  }

  const handleRemoveStage = (index: number) => {
    if (stages.length > 1) {
      setStages(stages.filter((_, i) => i !== index))
    }
  }

  const handlePlayerToggle = (_playerId: number, teamId: number | undefined) => {
    if (!teamId) return
    if (selectedTeamIds.includes(teamId)) {
      setSelectedTeamIds(selectedTeamIds.filter(id => id !== teamId))
    } else {
      setSelectedTeamIds([...selectedTeamIds, teamId])
    }
  }

  const handleSubmit = () => {
    setError(null)
    if (selectedTeamIds.length < 2) {
      setError('Seleziona almeno 2 partecipanti')
      return
    }
    const callback = createEventCallback
    const name = createEventName
    closeCreateEventModal()
    setError(null)
    setStages([])
    setSelectedTeamIds([])
    setScoreKind('outcome')
    if (callback) {
      callback(name, scoreKind, stages, selectedTeamIds)
    }
  }

  const handleCancel = () => {
    closeCreateEventModal()
    setError(null)
    setStages([])
    setSelectedTeamIds([])
    setScoreKind('outcome')
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content event-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Crea evento</h2>
        <p>Nome: <strong>{createEventName}</strong></p>

        <div className="event-modal-section">
          <label>Tipo punteggio:</label>
          <div className="score-kind-selector">
            <button
              className={`score-kind-btn ${scoreKind === 'outcome' ? 'active' : ''}`}
              onClick={() => setScoreKind('outcome')}
            >
              Vittoria/Sconfitta
            </button>
            <button
              className={`score-kind-btn ${scoreKind === 'points' ? 'active' : ''}`}
              onClick={() => setScoreKind('points')}
            >
              Punteggio
            </button>
          </div>
        </div>

        <div className="event-modal-section">
          <label>Fasi del torneo:</label>
          {stages.map((stage, index) => (
            <div key={index} className="stage-config">
              <span className="stage-number">Fase {index + 1}:</span>
              <select
                value={stage.kind}
                onChange={(e) => handleStageKindChange(index, e.target.value)}
              >
                {stageKinds.map((sk) => (
                  <option key={sk.kind} value={sk.kind}>{sk.label}</option>
                ))}
              </select>
              {stages.length > 1 && (
                <button className="remove-stage-btn" onClick={() => handleRemoveStage(index)}>×</button>
              )}
            </div>
          ))}
          <button className="add-stage-btn" onClick={handleAddStage}>+ Aggiungi fase</button>
        </div>

        <div className="event-modal-section">
          <label>Partecipanti ({selectedTeamIds.length} selezionati):</label>
          <div className="participants-list">
            {availablePlayers.map((player) => (
              <label key={player.id} className="participant-checkbox">
                <input
                  type="checkbox"
                  checked={player.team_id ? selectedTeamIds.includes(player.team_id) : false}
                  onChange={() => handlePlayerToggle(player.id, player.team_id ?? undefined)}
                />
                <span>{player.name}</span>
              </label>
            ))}
          </div>
        </div>

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
  const { selectedEvent, selectedEventWithBracket, selectedPlayer, selectedTeam } = useDataStore()

  return (
    <div className="app-wrapper">
      <HamburgerButton />
      <SideMenu />
      <InfoModal />
      <PinDisplayModal />
      <PinInputModal />
      <CreateOlympiadModal />
      <CreateEventModal />
      <main className="page-content">
        <div className="olympiad-bar">
          <OlympiadBadge />
        </div>
        {page === Page.OLYMPIAD && <Olympiads />}
        {page === Page.EVENTS && (selectedEventWithBracket ? <BracketView /> : (selectedEvent ? <EventDetailView /> : <Events />))}
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
  const { clearSelectedPlayer, clearSelectedEvent, clearSelectedTeam, clearSelectedEventWithBracket } = useDataStore()

  const handleNavigation = (targetPage: Page) => {
    clearSelectedPlayer()
    clearSelectedEvent()
    clearSelectedEventWithBracket()
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
  const { olympiads, selectOlympiad, fetchOlympiads } = useDataStore()
  const { showInfoModal, requestPin, openCreateOlympiadModal } = useUIStore()

  useEffect(() => {
    fetchOlympiads()
  }, [])

  const handleCreate = (name: string) => {
    openCreateOlympiadModal(name)  // Just open the modal, no callback
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
  const { selectedOlympiad, events, setEvents, clearSelectedOlympiad, setOlympiads, selectEventWithBracket } = useDataStore()
  const { setMainPage, showInfoModal, requestPin, openCreateEventModal } = useUIStore()

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

  const doCreateWithStages = async (
    name: string,
    scoreKind: 'points' | 'outcome',
    stages: StageConfig[],
    teamIds: number[],
    pin: string
  ) => {
    const res = await api.createEventWithStages(selectedOlympiad.id, name, scoreKind, stages, teamIds, pin)
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
    const newEvent: EventDetailWithBracket = await res.json()
    setEvents([...events, { id: newEvent.id, name: newEvent.name, status: newEvent.status, score_kind: newEvent.score_kind }])
    selectEventWithBracket(newEvent)
  }

  const handleCreate = (name: string) => {
    openCreateEventModal(name, (eventName, scoreKind, stages, teamIds) => {
      const pin = pinStorage.getPin(selectedOlympiad.id)
      if (pin) {
        doCreateWithStages(eventName, scoreKind, stages, teamIds, pin)
      } else {
        requestPin(selectedOlympiad.id, (enteredPin) => {
          doCreateWithStages(eventName, scoreKind, stages, teamIds, enteredPin)
        })
      }
    })
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
    const res = await api.getEventWithBracket(selectedOlympiad.id, event.id)
    if (res.ok) {
      const detail: EventDetailWithBracket = await res.json()
      selectEventWithBracket(detail)
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

// Bracket View Component - renders single elimination bracket
function BracketView() {
  const { selectedEventWithBracket, clearSelectedEventWithBracket } = useDataStore()

  if (!selectedEventWithBracket) return null

  const statusLabel = {
    registration: 'Iscrizioni aperte',
    started: 'In corso',
    finished: 'Terminato'
  }

  // Organize matches by round for single elimination
  const organizeMatchesByRound = (matches: MatchResponse[]): MatchResponse[][] => {
    if (matches.length === 0) return []

    // Find final match (no next_match_id)
    const finalMatch = matches.find(m => m.next_match_id === null)
    if (!finalMatch) return [matches]

    // BFS from final match backwards to organize into rounds
    const rounds: MatchResponse[][] = []
    let currentRound = [finalMatch]

    while (currentRound.length > 0) {
      rounds.unshift(currentRound)
      const prevRound: MatchResponse[] = []

      for (const match of currentRound) {
        // Find matches that feed into this one
        const feeders = matches.filter(m => m.next_match_id === match.id)
        prevRound.push(...feeders)
      }

      currentRound = prevRound
    }

    return rounds
  }

  const singleEliminationStage = selectedEventWithBracket.stages.find(s => s.kind === 'single_elimination')
  const rounds = singleEliminationStage ? organizeMatchesByRound(singleEliminationStage.matches) : []

  const getRoundName = (roundIndex: number, totalRounds: number): string => {
    const roundsFromEnd = totalRounds - roundIndex
    if (roundsFromEnd === 1) return 'Finale'
    if (roundsFromEnd === 2) return 'Semifinali'
    if (roundsFromEnd === 3) return 'Quarti'
    if (roundsFromEnd === 4) return 'Ottavi'
    return `Round ${roundIndex + 1}`
  }

  return (
    <div className="app-container bracket-container">
      <button className="back-button" onClick={clearSelectedEventWithBracket}>← Torna agli eventi</button>
      <h2 className="detail-title">{selectedEventWithBracket.name}</h2>
      <p className="bracket-status">Stato: {statusLabel[selectedEventWithBracket.status]}</p>

      {rounds.length > 0 ? (
        <div className="bracket-wrapper">
          <div className="bracket">
            {rounds.map((round, roundIndex) => (
              <div key={roundIndex} className="bracket-round">
                <div className="round-header">{getRoundName(roundIndex, rounds.length)}</div>
                <div className="round-matches">
                  {round.map((match) => (
                    <div key={match.id} className={`bracket-match ${match.status}`}>
                      {match.teams.length === 0 ? (
                        <>
                          <div className="match-team empty">TBD</div>
                          <div className="match-team empty">TBD</div>
                        </>
                      ) : match.teams.length === 1 ? (
                        <>
                          <div className="match-team bye">{match.teams[0].name}</div>
                          <div className="match-team empty">BYE</div>
                        </>
                      ) : (
                        match.teams.map((team, teamIndex) => (
                          <div
                            key={team.id}
                            className={`match-team ${teamIndex === 0 ? 'top' : 'bottom'}`}
                          >
                            <span className="team-name">{team.name}</span>
                            {team.score !== null && (
                              <span className="team-score">{team.score}</span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="empty-message">Nessun tabellone disponibile</p>
      )}

      <div className="bracket-teams-section">
        <h3>Partecipanti:</h3>
        <div className="bracket-teams-list">
          {selectedEventWithBracket.teams.map((team, i) => (
            <span key={team.id} className="bracket-team-badge" style={{ backgroundColor: COLORS[i % COLORS.length].bg, color: COLORS[i % COLORS.length].text }}>
              {team.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

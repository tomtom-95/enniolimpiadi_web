import { useState, useEffect } from 'react'
import './App.css'
import {
  api,
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
import { Page, useDataStore, useUIStore, pinStorage, fetchOlympiads, fetchEvents, fetchTeams, fetchPlayers } from './stores'

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

// PIN Input Modal - shown when PIN is needed
function PinInputModal() {
  const {
    pinInputModalOpen, pinInputModalOlympiadId,
    pinInputCallback, closePinInputModal, showInfoModal
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
      pinStorage.setPin(pinInputModalOlympiadId, pinValue)
      const callback = pinInputCallback
      closePinInputModal()
      setPinValue('')
      setError(null)
      if (callback) {
        callback(pinValue)
      }
    }
    else if (res.status === 404) {
      // Olympiad was deleted - show info modal, then close and refresh
      closePinInputModal()
      setPinValue('')
      setError(null)
      useDataStore.setState({ selectedOlympiad: null })
      useUIStore.setState({ page: Page.OLYMPIAD })
      showInfoModal('Olimpiade non trovata', 'Questa olimpiade è stata eliminata da un altro admin')
      fetchOlympiads()
    }
    else {
      // 401 or other error - show error message
      const errorData: { detail?: string } = await res.json()
      setError(errorData.detail || 'Errore durante la verifica del PIN')
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
  const { createOlympiadModalOpen, createOlympiadName, createOlympiadPin, closeCreateOlympiadModal, setCreateOlympiadPin, showInfoModal } = useUIStore()
  const { olympiads } = useDataStore()

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
        useDataStore.setState({ olympiads: [...olympiads, { id: data.id, name: data.name }] })
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
  const { createEventModalOpen, createEventName, createEventCallback, closeCreateEventModal } = useUIStore()
  const { selectedOlympiad } = useDataStore()

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
  const { page, menuOpen } = useUIStore()

  const handleNavigation = (targetPage: Page) => {
    useDataStore.setState({ selectedPlayer: null, selectedEvent: null, selectedEventWithBracket: null, selectedTeam: null })
    useUIStore.setState({ page: targetPage })
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
  olympiadId: number
  renameApi: (pin: string, newName: string) => Promise<Response>
  deleteApi: (pin: string) => Promise<Response>
  onRefresh: () => void
  onDeleteSuccess?: () => void
  requestPin: (olympiadId: number, callback: (pin: string) => void) => void
  showInfoModal: (title: string, message: string) => void
  entityName: string
}

function ItemButton({
  label,
  color,
  onClick,
  olympiadId,
  renameApi,
  deleteApi,
  onRefresh,
  onDeleteSuccess,
  requestPin,
  showInfoModal,
  entityName
}: ItemButtonProps) {
  const [hovered, setHovered] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(label)

  const style = {
    backgroundColor: hovered ? color.hoverBg : color.bg,
    color: hovered ? color.hoverText : color.text
  }

  // TODO: add check for when localStorage is lying about the PIN that belongs to a given olympiad_id
  const handleApiCall = (
    apiCall: (pin: string) => Promise<Response>,
    errorMessage: string,
    onSuccess?: () => void
  ) => {
    const executeWithPin = async (pin: string) => {
      const res = await apiCall(pin)
      if (!res.ok) {
        const error: { detail?: string } = await res.json()
        if (res.status === 401) {
          pinStorage.removePin(olympiadId)
          showInfoModal('Errore', 'PIN non valido')
        } else {
          showInfoModal('Errore', error.detail || errorMessage)
        }
      } else {
        onSuccess?.()
      }
      onRefresh()
    }

    const pin = pinStorage.getPin(olympiadId)
    if (pin) {
      executeWithPin(pin)
    } else {
      requestPin(olympiadId, executeWithPin)
    }
  }

  const handleRename = (newName: string) => {
    handleApiCall(
      (pin) => renameApi(pin, newName),
      `Impossibile rinominare ${entityName}`
    )
  }

  const handleDelete = () => {
    if (!confirm(`Sei sicuro di voler eliminare "${label}"?`)) return
    handleApiCall(
      (pin) => deleteApi(pin),
      `Impossibile eliminare ${entityName}`,
      onDeleteSuccess
    )
  }

  const handleRenameClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditValue(label)
    setIsEditing(true)
  }

  const handleRenameSubmit = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== label) {
      handleRename(trimmed)
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
    handleDelete()
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
  const { olympiads, selectOlympiad } = useDataStore()
  const { showInfoModal, requestPin, openCreateOlympiadModal } = useUIStore()

  useEffect(() => {
    fetchOlympiads()
  }, [])

  return (
    <div className="app-container">
      <PinInputModal />
      <AddItemInput
        placeholder="Nuova olimpiade..."
        onAdd={(name) => openCreateOlympiadModal(name)}
      />
      <div className="items-list">
        {olympiads.map((olympiad, i) => (
          <ItemButton
            key={olympiad.id}
            label={olympiad.name}
            color={COLORS[i % COLORS.length]}
            onClick={() => selectOlympiad(olympiad.id)}
            olympiadId={olympiad.id}
            renameApi={(pin, newName) => api.renameOlympiad(olympiad.id, newName, pin)}
            deleteApi={(pin) => api.deleteOlympiad(olympiad.id, pin)}
            onRefresh={fetchOlympiads}
            onDeleteSuccess={() => pinStorage.removePin(olympiad.id)}
            requestPin={requestPin}
            showInfoModal={showInfoModal}
            entityName="l'olimpiade"
          />
        ))}
      </div>
    </div>
  )
}

// Events Component
function Events() {
  const { selectedOlympiad, events } = useDataStore()
  const { showInfoModal, requestPin, openCreateEventModal } = useUIStore()

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
        useDataStore.setState({ selectedOlympiad: null })
        useUIStore.setState({ page: Page.OLYMPIAD })

        showInfoModal('Olimpiade non trovata', 'Questa olimpiade è stata eliminata.')
        const olympiadsRes = await api.getOlympiads()
        if (olympiadsRes.ok) {
          useDataStore.setState({ olympiads: await olympiadsRes.json() })
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
    useDataStore.setState({
      events: [...events, { id: newEvent.id, name: newEvent.name, status: newEvent.status, score_kind: newEvent.score_kind }],
      selectedEventWithBracket: newEvent
    })
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

  const handleSelect = async (event: EventResponse) => {
    const res = await api.getEventWithBracket(selectedOlympiad.id, event.id)
    if (res.ok) {
      const detail: EventDetailWithBracket = await res.json()
      useDataStore.setState({ selectedEventWithBracket: detail })
    }
  }

  return (
    <div className="app-container">
      <PinInputModal />
      <AddItemInput placeholder="Nuovo evento..." onAdd={handleCreate} />
      <div className="items-list">
        {events.map((event, i) => (
          <ItemButton
            key={event.id}
            label={event.name}
            color={COLORS[i % COLORS.length]}
            onClick={() => handleSelect(event)}
            olympiadId={selectedOlympiad.id}
            renameApi={(pin, newName) => api.updateEvent(selectedOlympiad.id, event.id, pin, newName)}
            deleteApi={(pin) => api.deleteEvent(selectedOlympiad.id, event.id, pin)}
            onRefresh={fetchEvents}
            requestPin={requestPin}
            showInfoModal={showInfoModal}
            entityName="l'evento"
          />
        ))}
      </div>
    </div>
  )
}

// Teams Component
function Teams() {
  const { selectedOlympiad, teams } = useDataStore()
  const { showInfoModal, requestPin } = useUIStore()

  useEffect(() => {
    fetchTeams()
  }, [])

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
        useDataStore.setState({ selectedOlympiad: null })
        useUIStore.setState({ page: Page.OLYMPIAD })
        showInfoModal('Olimpiade non trovata', 'Questa olimpiade è stata eliminata.')
        const olympiadsRes = await api.getOlympiads()
        if (olympiadsRes.ok) {
          useDataStore.setState({ olympiads: await olympiadsRes.json() })
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
    useDataStore.setState({ teams: [...teams, newTeam] })
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

  const handleSelect = async (team: TeamResponse) => {
    const res = await api.getTeam(selectedOlympiad.id, team.id)
    if (res.ok) {
      const detail: TeamDetail = await res.json()
      useDataStore.setState({ selectedTeam: detail })
    }
  }

  return (
    <div className="app-container">
      <PinInputModal />
      <AddItemInput placeholder="Nuova squadra..." onAdd={handleCreate} />
      <div className="items-list">
        {teams.map((team, i) => (
          <ItemButton
            key={team.id}
            label={team.name}
            color={COLORS[i % COLORS.length]}
            onClick={() => handleSelect(team)}
            olympiadId={selectedOlympiad.id}
            renameApi={(pin, newName) => api.renameTeam(selectedOlympiad.id, team.id, newName, pin)}
            deleteApi={(pin) => api.deleteTeam(selectedOlympiad.id, team.id, pin)}
            onRefresh={fetchTeams}
            requestPin={requestPin}
            showInfoModal={showInfoModal}
            entityName="la squadra"
          />
        ))}
      </div>
    </div>
  )
}

// Players Component
function Players() {
  const { selectedOlympiad, players, selectPlayer } = useDataStore()
  const { showInfoModal, requestPin } = useUIStore()

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
        useDataStore.setState({selectedOlympiad: null})
        useUIStore.setState({ page: Page.OLYMPIAD })
        showInfoModal('Olimpiade non trovata', 'Questa olimpiade è stata eliminata.')
        fetchOlympiads()
      }
      else if (res.status === 401) {
        pinStorage.removePin(selectedOlympiad.id)
        showInfoModal('Errore', 'PIN non valido')
      }
      else {
        showInfoModal('Errore', error.detail || 'Impossibile creare il giocatore')
        fetchPlayers()
      }
      return
    }
    const newPlayer: PlayerResponse = await res.json()
    useDataStore.setState({ players: [...players, newPlayer] })
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

  return (
    <div className="app-container">
      <PinInputModal />
      <AddItemInput placeholder="Nuovo giocatore..." onAdd={handleCreate} />
      <div className="items-list">
        {players.map((player, i) => (
          <ItemButton
            key={player.id}
            label={player.name}
            color={COLORS[i % COLORS.length]}
            onClick={() => selectPlayer(player.id)}
            olympiadId={selectedOlympiad.id}
            renameApi={(pin, newName) => api.renamePlayer(selectedOlympiad.id, player.id, newName, pin)}
            deleteApi={(pin) => api.deletePlayer(selectedOlympiad.id, player.id, pin)}
            onRefresh={fetchPlayers}
            requestPin={requestPin}
            showInfoModal={showInfoModal}
            entityName="il giocatore"
          />
        ))}
      </div>
    </div>
  )
}

// Event Detail Component
function EventDetailView() {
  const { selectedEvent } = useDataStore()

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
      <button className="back-button" onClick={() => useDataStore.setState({ selectedEvent: null })}>← Torna agli eventi</button>
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
  const { selectedTeam } = useDataStore()

  if (!selectedTeam) return null

  return (
    <div className="app-container">
      <button className="back-button" onClick={() => useDataStore.setState({ selectedTeam: null })}>← Torna alle squadre</button>
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
  const { selectedPlayer } = useDataStore()

  return (
    <div className="app-container">
      <button className="back-button" onClick={() => useDataStore.setState({ selectedPlayer: null })}>← Torna ai giocatori</button>
      <h2 className="detail-title">{selectedPlayer!.name}</h2>
    </div>
  )
}

// Bracket View Component - renders single elimination bracket
function BracketView() {
  const { selectedEventWithBracket } = useDataStore()

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
      <button className="back-button" onClick={() => useDataStore.setState({ selectedEventWithBracket: null })}>← Torna agli eventi</button>
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

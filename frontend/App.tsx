import { useState, useEffect } from 'react'
import './App.css'

import {
  api,
  PlayerResponse,
  TeamResponse,
  TeamDetail,
  EventResponse,
  EventDetailWithBracket,
  StageKindResponse,
  StageConfig,
  MatchResponse
} from './api'

import {
  Page,
  Modal,
  useStore,
  pinStorage,
  fetchOlympiads,
  fetchEvents,
  fetchTeams,
  fetchPlayers,
  createOlympiad,
  createPlayer,
  createEvent,
  createTeam,
  validateAndRenameOlympiad,
  validateAndDeleteOlympiad,
  validateAndRenameEntity,
  validateAndDeleteEntity,
  ItemType,
} from './stores'

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
  const { selectedOlympiad } = useStore()

  if (!selectedOlympiad) {
    return <div className="olympiad-badge empty">Nessuna olimpiade</div>
  } else {
    return <div className="olympiad-badge">{selectedOlympiad.name}</div>
  }
}

function InfoModal() {
  const { infoModalTitle, infoModalMessage, closeModal } = useStore()

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>{infoModalTitle}</h2>
        <p className="modal-info-message" style={{ whiteSpace: 'pre-line' }}>{infoModalMessage}</p>
        <button className="modal-ok-button" onClick={closeModal}>
          OK
        </button>
      </div>
    </div>
  )
}

function ConfirmDeleteModal() {
  const {
    confirmDeleteLabel,
    confirmDeleteItemType,
    confirmDeleteItemId,
    confirmDeleteItemVersion,
    closeModal
  } = useStore()

  if (!confirmDeleteItemType || confirmDeleteItemId === null || confirmDeleteItemVersion === null) {
    throw Error("confirmDelete item info is incomplete")
  }

  const handleConfirm = () => {
    closeModal()
    if (confirmDeleteItemType === 'olympiad') {
      validateAndDeleteOlympiad(confirmDeleteItemId, confirmDeleteItemVersion)
    }
    else {
      validateAndDeleteEntity(confirmDeleteItemType, confirmDeleteItemId, confirmDeleteItemVersion)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm()
    }
    else if (e.key === 'Escape') {
      closeModal()
    }
  }

  return (
    <div className="modal-overlay" onKeyDown={handleKeyDown}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Conferma eliminazione</h2>
        <p>Sei sicuro di voler eliminare "<strong>{confirmDeleteLabel}</strong>"?</p>
        <div className="modal-buttons">
          <button className="modal-cancel-button" onClick={closeModal} autoFocus>
            Annulla
          </button>
          <button className="modal-ok-button delete-confirm-btn" onClick={handleConfirm}>
            Elimina
          </button>
        </div>
      </div>
    </div>
  )
}

function PinInputModal() {
  const {
    pinInputModalOlympiadId,
    pinInputModalErrorMessage,
    pinInputCallback,
    closeModal
  } = useStore()

  if (!pinInputModalOlympiadId) throw Error("pinInputModalOlympiadId is null")
  if (!pinInputCallback) throw Error("pinInputCallback is null")

  const [pinValue, setPinValue] = useState('')

  const handleSubmit = async () => {
    if (pinValue.length !== 4) {
      useStore.setState({ pinInputModalErrorMessage: "Il PIN deve essere di 4 cifre" })
      return
    }
    else {
      pinInputCallback(pinValue)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    }
    else if (e.key === 'Escape') {
      closeModal()
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
        {pinInputModalErrorMessage && <p className="pin-error">{pinInputModalErrorMessage}</p>}
        <div className="modal-buttons">
          <button className="modal-cancel-button" onClick={closeModal}>
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
  const { createOlympiadName, closeModal } = useStore()

  const [pin, setPin] = useState(() => String(Math.floor(Math.random() * 10000)).padStart(4, '0'))
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setError(null)
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError('Il PIN deve essere di 4 cifre')
    }
    else {
      await createOlympiad(createOlympiadName, pin)
      closeModal()
    }
  }

  const handleCancel = () => {
    closeModal()
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
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
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
  const { createEventName, createEventCallback, closeModal, selectedOlympiad } = useStore()

  const [scoreKind, setScoreKind] = useState<'points' | 'outcome'>('outcome')
  const [stages, setStages] = useState<StageConfig[]>([])
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [availablePlayers, setAvailablePlayers] = useState<PlayerResponse[]>([])
  const [stageKinds, setStageKinds] = useState<StageKindResponse[]>([])

  useEffect(() => {
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
  }, [])

  useEffect(() => {
    if (selectedOlympiad) {
      // Fetch all players (each player has a single-player team with team_id)
      api.getPlayers(selectedOlympiad.id).then(async (res) => {
        if (res.ok) {
          const data: PlayerResponse[] = await res.json()
          setAvailablePlayers(data)
        }
      })
    }
  }, [selectedOlympiad])

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
    closeModal()
    setError(null)
    setStages([])
    setSelectedTeamIds([])
    setScoreKind('outcome')
    if (callback) {
      callback(name, scoreKind, stages, selectedTeamIds)
    }
  }

  const handleCancel = () => {
    closeModal()
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

function PageRouter() {
  const { page, selectedEvent, selectedEventWithBracket, selectedPlayer, selectedTeam } = useStore()

  switch (page) {
    case Page.OLYMPIAD:
      return <Olympiads />
    case Page.EVENTS:
      if (selectedEventWithBracket) return <BracketView />
      if (selectedEvent) return <EventDetailView />
      return <Events />
    case Page.PLAYERS:
      return selectedPlayer ? <PlayerDetail /> : <Players />
    case Page.TEAMS:
      return selectedTeam ? <TeamDetailView /> : <Teams />
    default:
      return null
  }
}

export default function App() {
  const { selectedOlympiad, activeModal } = useStore()

  useEffect(() => {
    const syncOlympiad = async () => {
      if (selectedOlympiad) {
        const res = await api.getOlympiad(selectedOlympiad.id)
        if (!res.ok) {
          useStore.setState({ selectedOlympiad: null })
        }
      }
    }
    syncOlympiad()
  }, [selectedOlympiad?.id])


  return (
    <div className="app-wrapper">
      <HamburgerButton />
      <SideMenu />
      {activeModal === Modal.INFO && <InfoModal />}
      {activeModal === Modal.CREATE_OLYMPIAD && <CreateOlympiadModal />}
      {activeModal === Modal.CREATE_EVENT && <CreateEventModal />}
      {activeModal === Modal.PIN_INPUT && <PinInputModal />}
      {activeModal === Modal.CONFIRM_DELETE && <ConfirmDeleteModal />}
      <main className="page-content">
        <div className="olympiad-bar">
          <OlympiadBadge />
        </div>
        <PageRouter />
      </main>
    </div>
  )
}

// HamburgerButton Component
function HamburgerButton() {
  const { menuOpen, toggleMenu } = useStore()

  return (
    <button className={`hamburger ${menuOpen ? 'open' : ''}`} onClick={toggleMenu}>
      <span></span>
      <span></span>
      <span></span>
    </button>
  )
}

function SideMenu() {
  const { page, menuOpen } = useStore()

  const handleNavigation = (targetPage: Page) => {
    useStore.setState({
      selectedPlayer: null,
      selectedEvent: null,
      selectedEventWithBracket: null,
      selectedTeam: null,
      page: targetPage
    })
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

// DeleteButton - handles deletion with confirmation
interface DeleteButtonProps {
  label: string
  itemType: ItemType
  itemId: number
  itemVersion: number
}

function DeleteButton({ label, itemType, itemId, itemVersion }: DeleteButtonProps) {
  const { showConfirmDeleteModal } = useStore()

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    showConfirmDeleteModal(label, itemType, itemId, itemVersion)
  }

  return (
    <button className="item-action-btn delete-btn" onClick={handleClick} title="Elimina">
      <span className="icon-trash"></span>
    </button>
  )
}

interface RenameButtonV2Props {
  itemType: ItemType
  itemId: number
}

function RenameButtonV2({itemType, itemId}: RenameButtonV2Props) {
  const handleOnClickRenameButtonV2 = () => {
    useStore.setState({ isRenamingTextboxOpen: true,  selectedItemType: itemType, selectedItemId: itemId})
  }

  return (
    <button className="item-action-btn rename-btn" onClick={handleOnClickRenameButtonV2} title="Rinomina">
      <span className="icon-pencil"></span>
    </button>
  )
}

interface RenameFieldProps {
  currValue: string
  style: React.CSSProperties
}

function RenameField({currValue, style}: RenameFieldProps) {
  const { selectedOlympiad } = useStore()
  const [newValue, setTmpEditValue] = useState(currValue)

  if (!selectedOlympiad) throw Error("selectedOlympiad is null")

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      useStore.setState({isRenamingTextboxOpen: false})
      const pin = pinStorage.getPin(selectedOlympiad.id)
      if (pin) {
        // renameItem could file because the Pin is stale or because the olympiad does not
        // exist anymore or a database error
        // the pin being stale or the olympiad not existing anymore are something that we must deal
        // with before calling every function that deals with modifying anything
        // the solution:

        //  validateOlympiadExistence()
        //  validatePin()
        // validateOlympiadExistence() is something we want to alwas do before any api call, but the thing is that if an given
        // record is not present anymore the backend will inform about that anyway
        // so what I want to do to have a central

        // Imagine having renameItem, deleteItem, someotherOperationItem
        //  in all the cases we must check for the olympiadExistence
        //   - one solution is to call validateOlympiadExistence before calling any of this function
        //      - if the olympiad id does not exist validateOlympiadExistence open an InfoModal telling that these olympiad has been deleted
        //      - since we do not know exactly what we were trying to do when validateOlympiadExistence was called the most straightforward
        //      - thing we can do is to call the backend to fetch an update olympiads list and redirect the user to the Olympiad page
        //      - this is the default behavior because it is the best we can do if we run validateOlympiadExistence, no external knowledge
        //   - the second solution is the one in which validateOlympiadExistence return something (for example a boolean) to the caller
        //   - in this case we know we are running renameItem, deleteItem or some other function, so we can open a modalInfo with more detail information
        //      (e.g. "Impossible to rename this item since the olympiad it refers to does not exist anymore")
        //      but if we just return true or false we are losing information. Maybe the api call return a 500, 404 (Olimpiade non trovata), or a 401 (PIN non valido)
        //      what it seems I want from the backend is an api call that can just return a status code of 200 if that olympiad id exist,
        //        404 if that olympiad id is not found and 500 for any other backend error
        //        do I really always want before any "real" api call have to run validateOlympiadExistence for checking if the olympiad really exist? It sound wasteful
        //   the alternative is to call the function renameItem that does the api call to rename directly -> renameItem(olympiadId, itemType, itemId, newName)
        //     this function can fail with error
        //        500 (generic backend error),
        //        412 (resource has been modified (different version number ))
        //        409,
        //        404, (olimpiade non trovata)
        //    what should this function return? The api calls can return a bunch of status code 
        //      if I am renam

        // renameItem(selectedItemType, selectedItemId, pin)
      }
      else {
        // Show pin modal where user is asked to insert the PIN
        // This is not enough because after the user as inserted a PIN and clicked OK I want to
        // run a function (renameItem or deleteItem ) which depends from where I come from
        // instead of having the function as a callback in the inputModal can I set up the function
        // in the global space? is this what is already happening?
        useStore.setState({ activeModal: Modal.PIN_INPUT })
      }
    }
    else if (e.key === 'Escape') {
      useStore.setState({isRenamingTextboxOpen: false})
    }
  }

  return (
    <div className="item-button item-button-editing" style={style}>
      <input
        type="text"
        className="item-rename-input"
        value={newValue}
        onChange={(e) => setTmpEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => useStore.setState({isRenamingTextboxOpen: false})}
        // Need this because RenameField is always inside a ItemButton
        // do avoid it I should render just the RenameField and not the ItemButton (I like it)
        onClick={(e) => e.stopPropagation()}
        autoFocus
      />
    </div>
  )
}

// RenameButton - handles renaming with inline edit mode
interface RenameButtonProps {
  currentName: string
  itemType: ItemType
  itemId: number
  itemVersion: number
  isEditing: boolean
  onEditingChange: (isEditing: boolean) => void
  editValue: string
  onEditValueChange: (value: string) => void
  style: React.CSSProperties
}

function RenameButton({
  currentName,
  itemType,
  itemId,
  itemVersion,
  isEditing,
  onEditingChange,
  editValue,
  onEditValueChange,
  style
}: RenameButtonProps) {
  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEditValueChange(currentName)
    onEditingChange(true)
  }

  const handleSubmit = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== currentName) {
      if (itemType === 'olympiad') {
        validateAndRenameOlympiad(itemId, trimmed, itemVersion)
      }
      else {
        validateAndRenameEntity(itemType, itemId, trimmed, itemVersion)
      }
    }
    onEditingChange(false)
  }

  const handleCancel = () => {
    onEditingChange(false)
    onEditValueChange(currentName)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (isEditing) {
    return (
      <div className="item-button item-button-editing" style={style}>
        <input
          type="text"
          className="item-rename-input"
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSubmit}
          onClick={(e) => e.stopPropagation()}
          autoFocus
        />
      </div>
    )
  }

  return (
    <button className="item-action-btn rename-btn" onClick={handleStartEdit} title="Rinomina">
      <span className="icon-pencil"></span>
    </button>
  )
}

interface ItemButtonProps {
  label: string
  color: ColorScheme
  onClick: () => void
  itemType: ItemType
  itemId: number
  itemVersion: number
}

function ItemButton({
  label,
  color,
  onClick,
  itemType,
  itemId,
  itemVersion
}: ItemButtonProps) {
  const [hovered, setHovered] = useState(false)

  const style = {
    backgroundColor: hovered ? color.hoverBg : color.bg,
    color: hovered ? color.hoverText : color.text
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
        <RenameButtonV2
          itemType={itemType}
          itemId={itemId}
        />
        <DeleteButton
          label={label}
          itemType={itemType}
          itemId={itemId}
          itemVersion={itemVersion}
        />
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
  const {
    olympiads,
    isRenamingTextboxOpen,
    selectedItemType,
    selectedItemId,
    openCreateOlympiadModal,
    selectOlympiad,
  } = useStore()

  useEffect(() => {
    fetchOlympiads()
  }, [])

  return (
    <div className="app-container">
      <AddItemInput
        placeholder="Nuova olimpiade..."
        onAdd={(name) => openCreateOlympiadModal(name)}
      />
      <div className="items-list">
        {olympiads.map((olympiad, i) => {
          const color = COLORS[i % COLORS.length]
          const style = { backgroundColor: color.bg, color: color.text }

          if (isRenamingTextboxOpen && selectedItemType === 'olympiad' && selectedItemId === olympiad.id) {
            return (
              <RenameField
                key={olympiad.id}
                currValue={olympiad.name}
                style={style}
              />
            )
          }
          else {
            return (
              <ItemButton
                key={olympiad.id}
                label={olympiad.name}
                color={color}
                onClick={() => selectOlympiad(olympiad.id)}
                itemType="olympiad"
                itemId={olympiad.id}
                itemVersion={olympiad.version}
              />
            )
          }
        })}
      </div>
    </div>
  )
}

// Events Component
function Events() {
  const { selectedOlympiad, events, showPinInputModal, openCreateEventModal } = useStore()

  if (!selectedOlympiad) {
    return (
      <div className="app-container">
        <p className="empty-message">Seleziona un'olimpiade per vedere gli eventi</p>
      </div>
    )
  }

  useEffect(() => {
    fetchEvents()
  }, [selectedOlympiad])

  const handleCreate = (name: string) => {
    openCreateEventModal(name, (eventName, scoreKind, stages, teamIds) => {
      const pin = pinStorage.getPin(selectedOlympiad.id)
      if (pin) {
        createEvent(eventName, scoreKind, stages, teamIds, pin)
      } else {
        showPinInputModal(selectedOlympiad.id, (enteredPin) => {
          createEvent(eventName, scoreKind, stages, teamIds, enteredPin)
        })
      }
    })
  }

  const handleSelect = async (event: EventResponse) => {
    const res = await api.getEventWithBracket(selectedOlympiad.id, event.id)
    if (res.ok) {
      const detail: EventDetailWithBracket = await res.json()
      useStore.setState({ selectedEventWithBracket: detail })
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
            itemType="event"
            itemId={event.id}
            itemVersion={event.version}
          />
        ))}
      </div>
    </div>
  )
}

// Teams Component
function Teams() {
  const { selectedOlympiad, teams, showPinInputModal } = useStore()

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

  const handleCreate = (name: string) => {
    const pin = pinStorage.getPin(selectedOlympiad.id)
    if (pin) {
      createTeam(name, pin)
    } else {
      showPinInputModal(selectedOlympiad.id, (enteredPin) => {
        createTeam(name, enteredPin)
      })
    }
  }

  const handleSelect = async (team: TeamResponse) => {
    const res = await api.getTeam(selectedOlympiad.id, team.id)
    if (res.ok) {
      const detail: TeamDetail = await res.json()
      useStore.setState({ selectedTeam: detail })
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
            itemType="team"
            itemId={team.id}
            itemVersion={team.version}
          />
        ))}
      </div>
    </div>
  )
}

// Players Component
function Players() {
  const { selectedOlympiad, players, selectPlayer, showPinInputModal } = useStore()

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

  const handleCreate = (name: string) => {
    const pin = pinStorage.getPin(selectedOlympiad.id)
    if (pin) {
      createPlayer(name, pin)
    }
    else {
      showPinInputModal(selectedOlympiad.id, (enteredPin) => { createPlayer(name, enteredPin) })
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
            itemType="player"
            itemId={player.id}
            itemVersion={player.version}
          />
        ))}
      </div>
    </div>
  )
}

// Event Detail Component
function EventDetailView() {
  const { selectedEvent } = useStore()

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
      <button className="back-button" onClick={() => useStore.setState({ selectedEvent: null })}>← Torna agli eventi</button>
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
  const { selectedTeam } = useStore()

  if (!selectedTeam) return null

  return (
    <div className="app-container">
      <button className="back-button" onClick={() => useStore.setState({ selectedTeam: null })}>← Torna alle squadre</button>
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
  const { selectedPlayer } = useStore()

  return (
    <div className="app-container">
      <button className="back-button" onClick={() => useStore.setState({ selectedPlayer: null })}>← Torna ai giocatori</button>
      <h2 className="detail-title">{selectedPlayer!.name}</h2>
    </div>
  )
}

// Bracket View Component - renders single elimination bracket
function BracketView() {
  const { selectedEventWithBracket } = useStore()

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
      <button className="back-button" onClick={() => useStore.setState({ selectedEventWithBracket: null })}>← Torna agli eventi</button>
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

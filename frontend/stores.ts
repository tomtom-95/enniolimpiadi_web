import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  api,
  OlympiadSummary,
  OlympiadCreateResponse,
  PlayerResponse,
  TeamResponse,
  TeamDetail,
  EventResponse,
  EventDetail,
  EventDetailWithBracket,
  StageConfig
} from './api'

export type ItemType = 'olympiad' | 'player' | 'team' | 'event'
export type EntityType = Exclude<ItemType, 'olympiad'>

export enum Page {
  OLYMPIAD = 'olympiad',
  EVENTS   = 'events',
  PLAYERS  = 'players',
  TEAMS    = 'teams'
}

export enum Modal {
  NONE            = 'none',
  INFO            = 'info',
  PIN_INPUT       = 'pin_input',
  CREATE_OLYMPIAD = 'create_olympiad',
  CREATE_EVENT    = 'create_event',
  CONFIRM_DELETE  = 'confirm_delete'
}

// ============================================
// PIN STORAGE - localStorage helpers
// ============================================
export const pinStorage = {
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

export async function verifyPin(olympiadId: number, pin: string): Promise<boolean> {
  const res = await api.verifyPin(olympiadId, pin)
  if (res.ok) {
    return true
  }
  else {
    if (res.status === 404) {
      useStore.setState({ selectedOlympiad: null, page: Page.OLYMPIAD })
      useStore.getState().closeModal()
      useStore.getState().showInfoModal(
        'Olimpiade non trovata', 'Questa olimpiade è stata eliminata.'
      )
      await fetchOlympiads()
      return false
    }
    else {
      return false
    }
  }
}

// ============================================
// STORE
// ============================================
interface Store {
  // Data
  olympiads: OlympiadSummary[]
  selectedOlympiad: OlympiadSummary | null
  players: PlayerResponse[]
  selectedPlayer: PlayerResponse | null
  teams: TeamResponse[]
  selectedTeam: TeamDetail | null
  events: EventResponse[]
  selectedEvent: EventDetail | null
  selectedEventWithBracket: EventDetailWithBracket | null
  loading: boolean
  error: string | null

  // UI
  page: Page
  menuOpen: boolean
  activeModal: Modal


  isRenamingTextboxOpen: boolean
  selectedItemType: ItemType | null
  selectedItemId: number

  // Modal data (used depending on which modal is active)
  infoModalTitle: string
  infoModalMessage: string
  pinInputModalOlympiadId: number | null
  pinInputModalErrorMessage: string
  pinInputCallback: ((pin: string) => void) | null
  pinInputCallbackV2: ((pin: string) => Promise<Response>) | null
  createOlympiadName: string
  createEventName: string
  createEventCallback: ((name: string, scoreKind: 'points' | 'outcome', stages: StageConfig[], teamIds: number[]) => void) | null
  confirmDeleteLabel: string
  confirmDeleteItemType: ItemType | null
  confirmDeleteItemId: number | null
  confirmDeleteItemVersion: number | null

  // Actions
  selectOlympiad: (id: number) => void
  selectPlayer: (id: number) => void
  toggleMenu: () => void
  closeModal: () => void
  showInfoModal: (title: string, message: string) => void
  showPinInputModal: (olympiadId: number, callback: (pin: string) => void) => void
  openCreateOlympiadModal: (name: string) => void
  openCreateEventModal: (name: string, callback: (name: string, scoreKind: 'points' | 'outcome', stages: StageConfig[], teamIds: number[]) => void) => void
  showConfirmDeleteModal: (label: string, itemType: ItemType, itemId: number, itemVersion: number) => void
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      // Data state
      olympiads: [],
      players: [],
      teams: [],
      events: [],

      selectedOlympiad: null,
      selectedPlayer: null,
      selectedTeam: null,
      selectedEvent: null,
      selectedEventWithBracket: null,
      loading: false,
      error: null,

      // UI state
      page: Page.OLYMPIAD,
      menuOpen: false,
      activeModal: Modal.NONE,

      isRenamingTextboxOpen: false,

      // State for the item that we are changing (renaming/deleting)
      selectedItemType: null,
      selectedItemId: 0,

      // Modal data
      infoModalTitle: '',
      infoModalMessage: '',
      pinInputModalOlympiadId: null,
      pinInputModalErrorMessage: '',
      pinInputCallback: null,
      pinInputCallbackV2: null,
      createOlympiadName: '',
      createEventName: '',
      createEventCallback: null,
      confirmDeleteLabel: '',
      confirmDeleteItemType: null,
      confirmDeleteItemId: null,
      confirmDeleteItemVersion: null,

      // Data actions
      selectOlympiad: (id) => {
        const olympiad = get().olympiads.find((o) => o.id === id) || null
        set({ selectedOlympiad: olympiad })
      },

      selectPlayer: (id) => {
        const player = get().players.find((p) => p.id === id) || null
        set({ selectedPlayer: player })
      },

      // UI actions
      toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen })),

      closeModal: () => {
        set({
          activeModal: Modal.NONE,
          infoModalTitle: '',
          infoModalMessage: '',
          pinInputModalErrorMessage: '',
          pinInputCallback: null,
          createOlympiadName: '',
          createEventName: '',
          createEventCallback: null,
          confirmDeleteLabel: '',
          confirmDeleteItemType: null,
          confirmDeleteItemId: null,
          confirmDeleteItemVersion: null
        })
      },

      showInfoModal: (title, message) => {
        set({ activeModal: Modal.INFO, infoModalTitle: title, infoModalMessage: message })
      },

      showPinInputModal: (olympiadId, callback) => {
        set({
          activeModal: Modal.PIN_INPUT,
          pinInputModalOlympiadId: olympiadId,
          pinInputCallback: callback
        })
      },

      openCreateOlympiadModal: (name) => set({
        activeModal: Modal.CREATE_OLYMPIAD,
        createOlympiadName: name
      }),

      openCreateEventModal: (name, callback) => set({
        activeModal: Modal.CREATE_EVENT,
        createEventName: name,
        createEventCallback: callback
      }),

      showConfirmDeleteModal: (label, itemType, itemId, itemVersion) => set({
        activeModal: Modal.CONFIRM_DELETE,
        confirmDeleteLabel: label,
        confirmDeleteItemType: itemType,
        confirmDeleteItemId: itemId,
        confirmDeleteItemVersion: itemVersion
      })
    }),
    {
      name: 'enniolimpiadi-store',
      partialize: (state) => ({
        selectedOlympiad: state.selectedOlympiad,
        selectedPlayer: state.selectedPlayer,
        selectedTeam: state.selectedTeam,
        selectedEvent: state.selectedEvent,
        page: state.page
      })
    }
  )
)

// ============================================
// DATA FETCHING FUNCTIONS
// ============================================

export async function fetchOlympiad(olympiadId: number): Promise<Response> {
  const res = await api.getOlympiad(olympiadId)
  return res
}

export async function fetchOlympiads(): Promise<void> {
  const res = await api.getOlympiads()
  if (res.ok) {
    const data: OlympiadSummary[] = await res.json()
    useStore.setState({ olympiads: data })
  }
  else {
    useStore.getState().showInfoModal(
      'Errore del server', 'Si è verificato un errore durante il caricamento delle olimpiadi. Riprova più tardi.'
    )
  }
}

export async function fetchEvents(): Promise<void> {
  const { selectedOlympiad } = useStore.getState()

  if (!selectedOlympiad) throw new Error('No olympiad selected')

  const res = await api.getEvents(selectedOlympiad.id)
  if (res.ok) {
    const data: EventResponse[] = await res.json()
    useStore.setState({ events: data })
  }
  else if (res.status === 404) {
    useStore.setState({ selectedOlympiad: null, page: Page.OLYMPIAD })
    await fetchOlympiads()
  }
}

export async function fetchTeams(): Promise<void> {
  const { selectedOlympiad } = useStore.getState()

  if (!selectedOlympiad) throw new Error('No olympiad selected')

  const res = await api.getTeams(selectedOlympiad.id)
  if (res.ok) {
    const data: TeamResponse[] = await res.json()
    useStore.setState({ teams: data })
  }
  else if (res.status === 404) {
    useStore.setState({ selectedOlympiad: null, page: Page.OLYMPIAD })
    await fetchOlympiads()
  }
}

export async function fetchPlayers(): Promise<void> {
  const { selectedOlympiad } = useStore.getState()

  if (!selectedOlympiad) throw new Error('No olympiad selected')

  const res = await api.getPlayers(selectedOlympiad.id)
  if (res.ok) {
    const data: PlayerResponse[] = await res.json()
    useStore.setState({ players: data })
  }
  else if (res.status === 404) {
    useStore.setState({ selectedOlympiad: null, page: Page.OLYMPIAD })
    await fetchOlympiads()
  }
}

// ============================================
// ENTITY CONFIG (for unified rename/delete)
// ============================================
type EntityConfig = {
  renameApiFn: (olympiadId: number, entityId: number, newName: string, pin: string, version: number) => Promise<Response>
  deleteApiFn: (olympiadId: number, entityId: number, pin: string, version: number) => Promise<Response>
  stateKey: 'players' | 'teams' | 'events'
  fetchFn: () => Promise<void>
  notFoundLabel: string
  renameErrorLabel: string
  deleteErrorLabel: string
  conflictLabel: string
}

const entityConfigs: Record<EntityType, EntityConfig> = {
  player: {
    renameApiFn: (olympiadId, entityId, newName, pin, version) => api.renamePlayer(olympiadId, entityId, newName, pin, version),
    deleteApiFn: (olympiadId, entityId, pin, version) => api.deletePlayer(olympiadId, entityId, pin, version),
    stateKey: 'players',
    fetchFn: fetchPlayers,
    notFoundLabel: 'Giocatore non trovato',
    renameErrorLabel: 'Impossibile rinominare il giocatore',
    deleteErrorLabel: 'Impossibile eliminare il giocatore',
    conflictLabel: 'Questo giocatore è stato modificato da un altro admin. La pagina verrà ricaricata.'
  },
  team: {
    renameApiFn: (olympiadId, entityId, newName, pin, version) => api.renameTeam(olympiadId, entityId, newName, pin, version),
    deleteApiFn: (olympiadId, entityId, pin, version) => api.deleteTeam(olympiadId, entityId, pin, version),
    stateKey: 'teams',
    fetchFn: fetchTeams,
    notFoundLabel: 'Squadra non trovata',
    renameErrorLabel: 'Impossibile rinominare la squadra',
    deleteErrorLabel: 'Impossibile eliminare la squadra',
    conflictLabel: 'Questa squadra è stata modificata da un altro admin. La pagina verrà ricaricata.'
  },
  event: {
    renameApiFn: (olympiadId, entityId, newName, pin, version) => api.updateEvent(olympiadId, entityId, pin, newName, version),
    deleteApiFn: (olympiadId, entityId, pin, version) => api.deleteEvent(olympiadId, entityId, pin, version),
    stateKey: 'events',
    fetchFn: fetchEvents,
    notFoundLabel: 'Evento non trovato',
    renameErrorLabel: "Impossibile rinominare l'evento",
    deleteErrorLabel: "Impossibile eliminare l'evento",
    conflictLabel: "Questo evento è stato modificato da un altro admin. La pagina verrà ricaricata."
  }
}

// ============================================
// DATA CREATION FUNCTIONS
// ============================================

export async function createOlympiad(name: string, pin: string): Promise<void> {
  const res = await api.createOlympiad(name, pin)
  if (res.ok) {
    const data: OlympiadCreateResponse = await res.json()
    pinStorage.setPin(data.id, data.pin)
    const { olympiads } = useStore.getState()
    const newOlympiad = { id: data.id, name: data.name, version: data.version }
    useStore.setState({ olympiads: [...olympiads, newOlympiad], selectedOlympiad: newOlympiad })
  }
  else {
    const error: { detail?: string } = await res.json()
    if (res.status === 409) {
      useStore.getState().showInfoModal(
        'Errore', "Esiste già un olimpiade con questo nome. La pagina verrà ricaricata con le informazioni aggiornate"
      )
      await fetchOlympiads()
    }
    else {
      useStore.getState().showInfoModal('Errore', error.detail || "Impossibile creare l'olimpiade")
    }
  }
}

export async function createPlayer(name: string, pin: string): Promise<void> {
  const { selectedOlympiad, players } = useStore.getState()

  if (!selectedOlympiad) throw new Error('No olympiad selected')

  const res = await api.createPlayer(selectedOlympiad.id, name, pin)
  if (res.ok) {
    const newPlayer: PlayerResponse = await res.json()
    useStore.setState({ players: [...players, newPlayer] })
  }
  else {
    const error: { detail?: string } = await res.json()
    if (res.status === 404) {
      useStore.setState({ selectedOlympiad: null, page: Page.OLYMPIAD })
      useStore.getState().showInfoModal('Olimpiade non trovata', 'Questa olimpiade è stata eliminata.')
      await fetchOlympiads()
    }
    else if (res.status === 401) {
      pinStorage.removePin(selectedOlympiad.id)
      useStore.getState().showInfoModal('Errore', 'PIN non valido')
    }
    else {
      useStore.getState().showInfoModal('Errore', error.detail || 'Impossibile creare il giocatore')
      await fetchPlayers()
    }
  }
}

export async function createEvent(
  name: string,
  scoreKind: 'points' | 'outcome',
  stages: StageConfig[],
  teamIds: number[],
  pin: string
): Promise<void> {
  const { selectedOlympiad, events } = useStore.getState()

  if (!selectedOlympiad) throw new Error('No olympiad selected')

  const res = await api.createEventWithStages(selectedOlympiad.id, name, scoreKind, stages, teamIds, pin)
  if (res.ok) {
    const newEvent: EventDetailWithBracket = await res.json()
    useStore.setState({
      events: [...events, { id: newEvent.id, name: newEvent.name, status: newEvent.status, score_kind: newEvent.score_kind, version: newEvent.version }],
      selectedEventWithBracket: newEvent
    })
  }
  else {
    const error: { detail?: string } = await res.json()
    if (res.status === 404) {
      useStore.setState({ selectedOlympiad: null, page: Page.OLYMPIAD })
      useStore.getState().showInfoModal('Olimpiade non trovata', 'Questa olimpiade è stata eliminata.')
      await fetchOlympiads()
    }
    else if (res.status === 401) {
      pinStorage.removePin(selectedOlympiad.id)
      useStore.getState().showInfoModal('Errore', 'PIN non valido')
    }
    else {
      useStore.getState().showInfoModal('Errore', error.detail || "Impossibile creare l'evento")
      await fetchEvents()
    }
  }
}

export async function createTeam(name: string, pin: string): Promise<void> {
  const { selectedOlympiad, teams } = useStore.getState()

  if (!selectedOlympiad) throw new Error('No olympiad selected')

  const res = await api.createTeam(selectedOlympiad.id, name, pin)
  if (res.ok) {
    const newTeam: TeamResponse = await res.json()
    useStore.setState({ teams: [...teams, newTeam] })
  }
  else {
    const error: { detail?: string } = await res.json()
    if (res.status === 404) {
      useStore.setState({ selectedOlympiad: null, page: Page.OLYMPIAD })
      useStore.getState().showInfoModal('Olimpiade non trovata', 'Questa olimpiade è stata eliminata.')
      await fetchOlympiads()
    }
    else if (res.status === 401) {
      pinStorage.removePin(selectedOlympiad.id)
      useStore.getState().showInfoModal('Errore', 'PIN non valido')
    }
    else {
      useStore.getState().showInfoModal('Errore', error.detail || 'Impossibile creare la squadra')
      await fetchTeams()
    }
  }
}

// ============================================
// PIN VALIDATION HELPER
// ============================================

async function validateLocalStoragePin(olympiadId: number): Promise<boolean> {
  const cachedPin = pinStorage.getPin(olympiadId)
  if (cachedPin) {
    const res = await api.verifyPin(olympiadId, cachedPin)
    if (res.ok) {
      return true
    }
    else {
      return false
    }
  }
  else {
    return false
  }
}

// Handles PIN validation flow, then executes the operation
// - Checks for cached PIN, validates it against DB
// - Shows PIN input modal if needed
// - Handles 404 (olympiad deleted) during validation
async function executeWithPinValidation(
  olympiadId: number,
  executeOperation: (pin: string) => Promise<Response>,
  handleResult: (status: number, data: unknown, pin: string) => Promise<void>
): Promise<void> {
  const { showPinInputModal, showInfoModal } = useStore.getState()

  const doOperation = async (pin: string) => {
    const res = await executeOperation(pin)
    // Handle empty responses (e.g., 204 No Content from delete operations)
    const text = await res.text()
    const data = text ? JSON.parse(text) : null
    await handleResult(res.status, data, pin)
  }

  const cachedPin = pinStorage.getPin(olympiadId)

  if (cachedPin) {
    const res = await api.verifyPin(olympiadId, cachedPin)
    if (res.ok) {
      await doOperation(cachedPin)
    }
    else if (res.status === 404) {
      if (olympiadId === useStore.getState().selectedOlympiad?.id) {
        useStore.setState({ selectedOlympiad: null, page: Page.OLYMPIAD })
      }
      showInfoModal('Olimpiade non trovata', 'Questa olimpiade è stata eliminata.')
      await fetchOlympiads()
    }
    else if (res.status === 401) {
      // Cached PIN is no longer valid
      pinStorage.removePin(olympiadId)
      showPinInputModal(olympiadId, doOperation)
    }
    else {
      showInfoModal('Errore', 'Errore durante la validazione del PIN')
    }
  }
  else {
    // No cached PIN, ask user for PIN
    showPinInputModal(olympiadId, doOperation)
  }
}

// ============================================
// OLYMPIAD OPERATIONS WITH PIN VALIDATION
// ============================================

export async function validateAndRenameOlympiad(
  olympiadId: number,
  newName: string,
  version: number
): Promise<void> {
  const { showPinInputModal, showInfoModal, closeModal } = useStore.getState()

  const handleResult = async (status: number, data: unknown, pin: string): Promise<void> => {
    if (status === 200) {
      pinStorage.setPin(olympiadId, pin)
      const { olympiads, selectedOlympiad } = useStore.getState()
      const olympiadData = data as OlympiadSummary
      const updated = olympiads.map(o =>
        o.id === olympiadId ? { ...o, name: newName, version: olympiadData.version } : o
      )
      useStore.setState({ olympiads: updated })
      if (selectedOlympiad?.id === olympiadId) {
        useStore.setState({ selectedOlympiad: { ...selectedOlympiad, name: newName, version: olympiadData.version } })
      }
      closeModal()
    }
    else if (status === 404) {
      if (olympiadId === useStore.getState().selectedOlympiad?.id) {
        useStore.setState({ selectedOlympiad: null })
      }
      const { olympiads } = useStore.getState()
      useStore.setState({ olympiads: olympiads.filter(o => o.id !== olympiadId) })
      showInfoModal(
        'Olimpiade non trovata',
        'Questa olimpiade è stata eliminata da un altro admin. La pagina verrà ricaricata.'
      )
      await fetchOlympiads()
    }
    else if (status === 401) {
      pinStorage.removePin(olympiadId)
      useStore.setState({ pinInputModalErrorMessage: 'PIN non valido' })
      showPinInputModal(olympiadId, async (enteredPin) => {
        const res = await api.renameOlympiad(olympiadId, newName, enteredPin, version)
        const retryData = await res.json()
        await handleResult(res.status, retryData, enteredPin)
      })
    }
    else if (status === 412) {
      showInfoModal(
        'Conflitto',
        'Questa olimpiade è stata modificata da un altro admin. La pagina verrà ricaricata.'
      )
      await fetchOlympiads()
    }
    else {
      showInfoModal('Errore', 'Impossibile rinominare l\'olimpiade')
    }
  }

  await executeWithPinValidation(
    olympiadId,
    (pin) => api.renameOlympiad(olympiadId, newName, pin, version),
    handleResult
  )
}

export async function validateAndDeleteOlympiad(
  olympiadId: number,
  version: number
): Promise<void> {
  const { showPinInputModal, showInfoModal, closeModal } = useStore.getState()

  const handleResult = async (status: number, _data: unknown, _pin: string): Promise<void> => {
    if (status === 200 || status === 204) {
      pinStorage.removePin(olympiadId)
      const { olympiads } = useStore.getState()
      useStore.setState({ olympiads: olympiads.filter(o => o.id !== olympiadId) })
      if (olympiadId === useStore.getState().selectedOlympiad?.id) {
        useStore.setState({ selectedOlympiad: null })
      }
      closeModal()
    }
    else if (status === 404) {
      if (olympiadId === useStore.getState().selectedOlympiad?.id) {
        useStore.setState({ selectedOlympiad: null })
      }
      const { olympiads } = useStore.getState()
      useStore.setState({ olympiads: olympiads.filter(o => o.id !== olympiadId) })
      showInfoModal(
        'Olimpiade non trovata',
        'Questa olimpiade è stata già eliminata da un altro admin. La pagina verrà ricaricata.'
      )
      await fetchOlympiads()
    }
    else if (status === 401) {
      pinStorage.removePin(olympiadId)
      useStore.setState({ pinInputModalErrorMessage: 'PIN non valido' })
      showPinInputModal(olympiadId, async (enteredPin) => {
        const res = await api.deleteOlympiad(olympiadId, enteredPin, version)
        const retryData = await res.json()
        await handleResult(res.status, retryData, enteredPin)
      })
    }
    else if (status === 412) {
      showInfoModal(
        'Conflitto',
        'Questa olimpiade è stata modificata da un altro admin. La pagina verrà ricaricata.'
      )
      await fetchOlympiads()
    }
    else {
      showInfoModal('Errore', 'Impossibile eliminare l\'olimpiade')
    }
  }

  await executeWithPinValidation(
    olympiadId,
    (pin) => api.deleteOlympiad(olympiadId, pin, version),
    handleResult
  )
}

// ============================================
// ENTITY OPERATIONS WITH PIN VALIDATION
// ============================================

export async function validateAndRenameEntity(
  type: EntityType,
  entityId: number,
  newName: string,
  version: number
): Promise<void> {
  const { selectedOlympiad } = useStore.getState()
  if (!selectedOlympiad) throw new Error('No olympiad selected')

  const config = entityConfigs[type]
  const { showPinInputModal, showInfoModal, closeModal } = useStore.getState()

  const handleResult = async (status: number, data: unknown, pin: string): Promise<void> => {
    if (status === 200) {
      pinStorage.setPin(selectedOlympiad.id, pin)
      const entityData = data as { version: number }
      const list = useStore.getState()[config.stateKey] as { id: number; name: string; version: number }[]
      const updated = list.map(item =>
        item.id === entityId ? { ...item, name: newName, version: entityData.version } : item
      )
      useStore.setState({ [config.stateKey]: updated })
      closeModal()
    }
    else if (status === 404) {
      showInfoModal('Errore', config.notFoundLabel)
      await config.fetchFn()
    }
    else if (status === 401) {
      pinStorage.removePin(selectedOlympiad.id)
      useStore.setState({ pinInputModalErrorMessage: 'PIN non valido' })
      showPinInputModal(selectedOlympiad.id, async (enteredPin) => {
        const res = await config.renameApiFn(selectedOlympiad.id, entityId, newName, enteredPin, version)
        const retryData = await res.json()
        await handleResult(res.status, retryData, enteredPin)
      })
    }
    else if (status === 412) {
      showInfoModal('Conflitto', config.conflictLabel)
      await config.fetchFn()
    }
    else {
      const errorData = data as { detail?: string }
      showInfoModal('Errore', errorData.detail || config.renameErrorLabel)
    }
  }

  await executeWithPinValidation(
    selectedOlympiad.id,
    (pin) => config.renameApiFn(selectedOlympiad.id, entityId, newName, pin, version),
    handleResult
  )
}

export async function validateAndDeleteEntity(
  type: EntityType,
  entityId: number,
  entityVersion: number
): Promise<void> {
  const { selectedOlympiad } = useStore.getState()
  if (!selectedOlympiad) throw new Error('No olympiad selected')

  const config = entityConfigs[type]
  const { showPinInputModal, showInfoModal, closeModal } = useStore.getState()

  const handleResult = async (status: number, data: unknown, _pin: string): Promise<void> => {
    if (status === 200 || status === 204) {
      const list = useStore.getState()[config.stateKey] as { id: number }[]
      const updated = list.filter(item => item.id !== entityId)
      useStore.setState({ [config.stateKey]: updated })
      closeModal()
    }
    else if (status === 404) {
      showInfoModal('Errore', config.notFoundLabel)
      await config.fetchFn()
    }
    else if (status === 401) {
      pinStorage.removePin(selectedOlympiad.id)
      useStore.setState({ pinInputModalErrorMessage: 'PIN non valido' })
      showPinInputModal(selectedOlympiad.id, async (enteredPin) => {
        const res = await config.deleteApiFn(selectedOlympiad.id, entityId, enteredPin, entityVersion)
        const retryData = await res.json()
        await handleResult(res.status, retryData, enteredPin)
      })
    }
    else if (status === 412) {
      showInfoModal('Conflitto', config.conflictLabel)
      await config.fetchFn()
    }
    else {
      const errorData = data as { detail?: string }
      showInfoModal('Errore', errorData.detail || config.deleteErrorLabel)
    }
  }

  const cachedPin = pinStorage.getPin(selectedOlympiad.id)
  if (cachedPin) {
    const res = api.verifyPin(selectedOlympiad.id, cachedPin)
    showPinInputModal(selectedOlympiad.id, type, entityId)
  }
  else {
    // must ask the user 
  }

  // Validate PIN
  const isPinValid = await validateLocalStoragePin(selectedOlympiad.id)
  if (isPinValid)

  await executeWithPinValidation(
    selectedOlympiad.id,
    (pin) => config.deleteApiFn(selectedOlympiad.id, entityId, pin, entityVersion),
    handleResult
  )
}

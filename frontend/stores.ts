import { create } from 'zustand'
import {
  api,
  OlympiadSummary,
  PlayerResponse,
  TeamResponse,
  TeamDetail,
  EventResponse,
  EventDetail,
  EventDetailWithBracket,
  StageConfig
} from './api'

export enum Page {
  OLYMPIAD = 'olympiad',
  EVENTS   = 'events',
  PLAYERS  = 'players',
  TEAMS    = 'teams'
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
  selectedEventWithBracket: EventDetailWithBracket | null
  loading: boolean
  error: string | null

  // Actions
  selectOlympiad: (id: number) => void
  // clearSelectedOlympiad: () => void
  selectPlayer: (id: number) => void
  clearSelectedPlayer: () => void
  selectTeam: (team: TeamDetail) => void
  clearSelectedTeam: () => void
  selectEvent: (event: EventDetail) => void
  clearSelectedEvent: () => void
  selectEventWithBracket: (event: EventDetailWithBracket) => void
  clearSelectedEventWithBracket: () => void
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

  // Create event modal
  createEventModalOpen: boolean
  createEventName: string
  createEventCallback: ((name: string, scoreKind: 'points' | 'outcome', stages: StageConfig[], teamIds: number[]) => void) | null

  toggleMenu: () => void
  showInfoModal: (title: string, message: string) => void
  closeInfoModal: () => void
  showCreatedPinModal: (olympiadName: string, pin: string) => void
  closeCreatedPinModal: () => void
  requestPin: (olympiadId: number, callback: (pin: string) => void) => void
  closePinInputModal: () => void
  openCreateOlympiadModal: (name: string) => void
  closeCreateOlympiadModal: () => void
  setCreateOlympiadPin: (pin: string) => void
  openCreateEventModal: (name: string, callback: (name: string, scoreKind: 'points' | 'outcome', stages: StageConfig[], teamIds: number[]) => void) => void
  closeCreateEventModal: () => void
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

// ============================================
// DATA STORE IMPLEMENTATION
// ============================================
export const useDataStore = create<DataStore>((set, get) => ({
  olympiads: [],
  players: [],
  selectedPlayer: null,
  teams: [],
  selectedTeam: null,
  events: [],
  selectedEvent: null,
  selectedEventWithBracket: null,
  selectedOlympiad: null,
  loading: false,
  error: null,

  selectOlympiad: (id) => {
    const olympiad = get().olympiads.find((o) => o.id === id) || null
    set({ selectedOlympiad: olympiad })
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
  },

  selectEventWithBracket: (event) => {
    set({ selectedEventWithBracket: event })
  },

  clearSelectedEventWithBracket: () => {
    set({ selectedEventWithBracket: null })
  }
}))

// ============================================
// UI STORE IMPLEMENTATION
// ============================================
export const useUIStore = create<UIStore>((set) => ({
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
  createEventModalOpen: false,
  createEventName: '',
  createEventCallback: null,

  toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen })),
  showInfoModal: (title, message) => set({ infoModalOpen: true, infoModalTitle: title, infoModalMessage: message }),
  closeInfoModal: () => set({ infoModalOpen: false, infoModalTitle: '', infoModalMessage: '' }),
  showCreatedPinModal: (olympiadName, pin) => set({ showPinModal: true, pinModalOlympiadName: olympiadName, pinModalPin: pin }),
  closeCreatedPinModal: () => set({ showPinModal: false, pinModalPin: '', pinModalOlympiadName: '' }),
  requestPin: (olympiadId, callback) => set({ pinInputModalOpen: true, pinInputModalOlympiadId: olympiadId, pinInputCallback: callback }),
  closePinInputModal: () => set({ pinInputModalOpen: false, pinInputModalOlympiadId: null, pinInputCallback: null }),

  openCreateOlympiadModal: (name) => set({
    createOlympiadModalOpen: true,
    createOlympiadName: name,
    createOlympiadPin: String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  }),
  closeCreateOlympiadModal: () => set({
    createOlympiadModalOpen: false,
    createOlympiadName: '',
    createOlympiadPin: ''
  }),

  setCreateOlympiadPin: (pin) => set({ createOlympiadPin: pin }),

  openCreateEventModal: (name, callback) => set({
    createEventModalOpen: true,
    createEventName: name,
    createEventCallback: callback
  }),
  closeCreateEventModal: () => set({
    createEventModalOpen: false,
    createEventName: '',
    createEventCallback: null
  })
}))

// ============================================
// DATA FETCHING FUNCTIONS
// ============================================

export async function fetchOlympiads(): Promise<void> {
  const res = await api.getOlympiads()
  if (res.ok) {
    const data: OlympiadSummary[] = await res.json()
    useDataStore.setState({ olympiads: data })
  }
}

export async function fetchEvents(): Promise<void> {
  const { selectedOlympiad } = useDataStore.getState()

  if (!selectedOlympiad) {
    return
  }

  const res = await api.getEvents(selectedOlympiad.id)
  if (res.ok) {
    const data: EventResponse[] = await res.json()
    useDataStore.setState({ events: data })
  }
  else if (res.status === 404) {
    useDataStore.setState({ selectedOlympiad: null })
    useUIStore.setState({page: Page.OLYMPIAD})
    await fetchOlympiads()
  }
}

export async function fetchTeams(): Promise<void> {
  const { selectedOlympiad } = useDataStore.getState()

  if (!selectedOlympiad) {
    return
  }

  const res = await api.getTeams(selectedOlympiad.id)
  if (res.ok) {
    const data: TeamResponse[] = await res.json()
    useDataStore.setState({ teams: data })
  }
  else if (res.status === 404) {
    useDataStore.setState({ selectedOlympiad: null })
    useUIStore.setState({page: Page.OLYMPIAD})
    await fetchOlympiads()
  }
}

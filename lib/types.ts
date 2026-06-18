export type Role = 'admin' | 'member' | 'guest'
export type EventSource = 'manual' | 'aula'

export interface FamilyMember {
  id: string
  name: string
  color: string
  role: Role
  email: string
}

export interface CalendarEvent {
  id: string
  familyId: string
  userId: string
  title: string
  description?: string
  location?: string
  startAt: Date
  endAt: Date
  allDay: boolean
  recurring?: RecurringRule
  source: EventSource
  aulaUid?: string
  transport?: string
  member?: FamilyMember
}

export interface RecurringRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  until?: string
  count?: number
  byday?: string[]
  interval?: number
}

export interface AulaFeed {
  id: string
  familyId: string
  userId: string
  childName: string
  icsUrl: string
  lastSyncedAt?: Date
  lastEventCount?: number
  lastError?: string
}

export interface InviteToken {
  id: string
  familyId: string
  token: string
  createdBy?: string
  expiresAt: Date
  usedAt?: Date
}

// Default color palette for the 5 family members
export const FAMILY_COLORS: Record<string, string> = {
  Nicklas: '#6366f1',
  Camilla: '#ec4899',
  Noah:    '#22c55e',
  Emily:   '#f97316',
  Mads:    '#06b6d4',
}

export const DEFAULT_COLORS = [
  '#6366f1', // indigo
  '#ec4899', // pink
  '#22c55e', // green
  '#f97316', // orange
  '#06b6d4', // cyan
  '#a855f7', // purple
  '#eab308', // yellow
  '#ef4444', // red
]

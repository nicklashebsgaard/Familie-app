export type Role = 'admin' | 'member' | 'guest'
export type EventSource = 'manual' | 'aula'

export interface FamilyMember {
  id: string
  name: string
  color: string
  role: Role
  email: string
  avatarUrl?: string | null
}

// Children or people without an auth account — managed by admins
export interface ManagedMember {
  id: string
  name: string
  color: string
  familyId: string
  avatarUrl?: string | null
}

export interface CalendarEvent {
  id: string
  familyId: string
  userId: string
  managedMemberId?: string
  title: string
  description?: string
  location?: string
  startAt: Date
  endAt: Date
  allDay: boolean
  recurring?: RecurringRule
  recurringGroupId?: string | null
  source: EventSource
  feedLabel?: string
  aulaUid?: string
  transport?: string
  // The person this event belongs to visually (managed member takes precedence)
  member?: FamilyMember
  managedMember?: ManagedMember
  // All participants (resolved). Empty = fall back to member/managedMember
  participants?: (FamilyMember | ManagedMember)[]
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

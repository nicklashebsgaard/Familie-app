import type { FamilyMember, CalendarEvent } from './types'

export function canEdit(user: FamilyMember, event: CalendarEvent): boolean {
  return user.role === 'admin' || event.userId === user.id
}

export function canDelete(user: FamilyMember, event: CalendarEvent): boolean {
  return user.role === 'admin' || event.userId === user.id
}

export function canInvite(user: FamilyMember): boolean {
  return user.role === 'admin'
}

export function canManageFamily(user: FamilyMember): boolean {
  return user.role === 'admin'
}

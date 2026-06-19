// eslint-disable-next-line @typescript-eslint/no-require-imports
const ICAL = require('ical.js')

export interface ParsedEvent {
  aula_uid: string
  title: string
  description: string | null
  location: string | null
  start_at: string
  end_at: string
  all_day: boolean
  family_id: string
  user_id: string
  managed_member_id: string | null
  participants: string[]
  source: 'aula'
}

export function parseIcsToEvents(
  icsText: string,
  familyId: string,
  userId: string,
  managedMemberId?: string | null,
): ParsedEvent[] {
  const jcal = ICAL.parse(icsText)
  const comp = new ICAL.Component(jcal)
  const vevents = comp.getAllSubcomponents('vevent')

  const events: ParsedEvent[] = []

  for (const vevent of vevents) {
    try {
      const ev = new ICAL.Event(vevent)
      const startDate = ev.startDate
      const endDate = ev.endDate

      // Skip events without required fields
      if (!ev.uid || !ev.summary || !startDate) continue

      // Convert to JS dates
      const startJs = startDate.toJSDate()
      const endJs = endDate ? endDate.toJSDate() : new Date(startJs.getTime() + 3600000)

      // For all-day events DTEND is exclusive in iCal — keep as-is for storage
      const participant = managedMemberId
        ? `managed:${managedMemberId}`
        : `auth:${userId}`
      events.push({
        aula_uid: ev.uid,
        title: ev.summary || '(ingen titel)',
        description: ev.description || null,
        location: ev.location || null,
        start_at: startJs.toISOString(),
        end_at: endJs.toISOString(),
        all_day: startDate.isDate,
        family_id: familyId,
        user_id: userId,
        managed_member_id: managedMemberId ?? null,
        participants: [participant],
        source: 'aula',
      })
    } catch {
      // Skip malformed events
    }
  }

  return events
}

import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToUser } from '@/lib/webpush'
import { NextResponse } from 'next/server'
import { format } from 'date-fns'
import { da } from 'date-fns/locale'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Runs at 18:00 UTC = 20:00 CEST / 19:00 CET
// Checks tomorrow's events for each family and sends a weather warning push if bad weather is forecast.

const RAIN_THRESHOLD_MM = 2   // > 2mm = notable rain
const WIND_THRESHOLD_KMH = 40 // > 40 km/h = notable wind

// Copenhagen coordinates (default — good enough for a Danish family app)
const LAT = 55.67
const LNG = 12.57

interface WeatherDay {
  precipMm: number
  windKmh: number
  code: number
}

function buildWarning(w: WeatherDay): string | null {
  const parts: string[] = []
  if (w.precipMm > RAIN_THRESHOLD_MM) {
    const emoji = w.code >= 70 ? '❄️' : '🌧️'
    parts.push(`${Math.round(w.precipMm)} mm nedbør ${emoji}`)
  }
  if (w.windKmh > WIND_THRESHOLD_KMH) {
    parts.push(`${Math.round(w.windKmh)} km/h vind 💨`)
  }
  return parts.length ? parts.join(' og ') : null
}

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Compute tomorrow's date in Danish timezone
  const now = new Date()
  const tomorrowUTC = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  // en-CA gives ISO-style YYYY-MM-DD output directly
  const tomorrowISO = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Copenhagen',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(tomorrowUTC)

  // Fetch 2-day forecast from Open-Meteo (index 0 = today, index 1 = tomorrow)
  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${LAT}&longitude=${LNG}` +
    `&daily=precipitation_sum,windspeed_10m_max,weathercode` +
    `&timezone=Europe/Copenhagen&forecast_days=2`

  let tomorrow: WeatherDay
  try {
    const res = await fetch(weatherUrl, { next: { revalidate: 0 } })
    const data = await res.json()
    tomorrow = {
      precipMm: data.daily?.precipitation_sum?.[1] ?? 0,
      windKmh: data.daily?.windspeed_10m_max?.[1] ?? 0,
      code: data.daily?.weathercode?.[1] ?? 0,
    }
  } catch {
    return NextResponse.json({ error: 'Weather fetch failed' }, { status: 502 })
  }

  const warning = buildWarning(tomorrow)
  if (!warning) {
    return NextResponse.json({ sent: 0, reason: 'godt vejr', tomorrow: tomorrowISO })
  }

  // Fetch all families that have events tomorrow
  const supabase = createServiceClient()

  // Wide ±3h UTC range, then filter by Copenhagen date in JS (same pattern as dag/page.tsx)
  const rangeStart = new Date(tomorrowISO + 'T00:00:00Z')
  rangeStart.setUTCHours(rangeStart.getUTCHours() - 3)
  const rangeEnd = new Date(tomorrowISO + 'T23:59:59Z')
  rangeEnd.setUTCHours(rangeEnd.getUTCHours() + 3)
  const toCopenhagenDate = (iso: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen' }).format(new Date(iso))

  const { data: rawEvents } = await supabase
    .from('events')
    .select('id, title, start_at, all_day, family_id')
    .gte('start_at', rangeStart.toISOString())
    .lte('start_at', rangeEnd.toISOString())
    .order('start_at')

  const events = (rawEvents ?? []).filter((e) => toCopenhagenDate(e.start_at) === tomorrowISO)

  if (!events?.length) {
    return NextResponse.json({ sent: 0, reason: 'ingen events i morgen', tomorrow: tomorrowISO })
  }

  // Group event titles per family
  const byFamily = new Map<string, string[]>()
  for (const ev of events) {
    if (!ev.family_id) continue
    if (!byFamily.has(ev.family_id)) byFamily.set(ev.family_id, [])
    const time = ev.all_day
      ? 'Hele dagen'
      : format(new Date(ev.start_at), 'HH:mm', { locale: da })
    byFamily.get(ev.family_id)!.push(`${time} – ${ev.title}`)
  }

  if (!byFamily.size) {
    return NextResponse.json({ sent: 0, reason: 'ingen family events', tomorrow: tomorrowISO })
  }

  // Fetch all users with push subscriptions in these families
  const familyIds = Array.from(byFamily.keys())
  const { data: users } = await supabase
    .from('users')
    .select('id, name, family_id, push_subscriptions(endpoint, p256dh, auth)')
    .in('family_id', familyIds)

  if (!users?.length) {
    return NextResponse.json({ sent: 0, reason: 'ingen brugere med push', tomorrow: tomorrowISO })
  }

  let sent = 0
  const allExpired: string[] = []

  for (const user of users) {
    const subs = (user.push_subscriptions as { endpoint: string; p256dh: string; auth: string }[]) ?? []
    if (!subs.length || !user.family_id) continue

    const lines = byFamily.get(user.family_id) ?? []
    if (!lines.length) continue

    const eventSummary = lines.slice(0, 3).join(', ')
    const extraCount = lines.length > 3 ? ` +${lines.length - 3} mere` : ''

    const { expiredEndpoints } = await sendPushToUser(subs, {
      title: `Vejrvarsel for i morgen ⚠️`,
      body: `${eventSummary}${extraCount} — der forventes ${warning}`,
      url: '/',
    })
    allExpired.push(...expiredEndpoints)
    sent++
  }

  if (allExpired.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', allExpired)
  }

  return NextResponse.json({ sent, warning, tomorrow: tomorrowISO, families: byFamily.size, cleaned: allExpired.length })
}

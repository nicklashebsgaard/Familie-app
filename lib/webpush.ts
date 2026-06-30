import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_MAILTO!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

export interface PushPayload {
  title: string
  body: string
  url?: string
}

// Returns endpoints that returned 410 Gone (subscription expired) so callers can clean them up.
export async function sendPushToUser(
  subscriptions: { endpoint: string; p256dh: string; auth: string }[],
  payload: PushPayload,
): Promise<{ expiredEndpoints: string[] }> {
  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        )
        .then(() => ({ endpoint: sub.endpoint, expired: false }))
        .catch((err: { statusCode?: number }) => ({
          endpoint: sub.endpoint,
          expired: err?.statusCode === 410,
        }))
    )
  )

  const expiredEndpoints = results
    .filter((r): r is PromiseFulfilledResult<{ endpoint: string; expired: boolean }> =>
      r.status === 'fulfilled'
    )
    .filter((r) => r.value.expired)
    .map((r) => r.value.endpoint)

  return { expiredEndpoints }
}

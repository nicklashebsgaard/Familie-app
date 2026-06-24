// Minimal push-only service worker — no workbox dependencies
self.addEventListener('push', function(event) {
  var data = event.data ? event.data.json() : {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Ny begivenhed', {
      body: data.body || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      tag: 'famille-event',
      data: { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if ('focus' in clientList[i]) return clientList[i].focus()
      }
      if (clients.openWindow) {
        return clients.openWindow((event.notification.data && event.notification.data.url) || '/')
      }
    })
  )
})

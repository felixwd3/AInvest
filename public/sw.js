self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'AINVEST'
  const options = {
    body: data.body || 'Ny opdatering fra din aktierådgiver',
    icon: '/logo.png',
    badge: '/logo.png'
  }
  event.waitUntil(self.registration.showNotification(title, options))
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
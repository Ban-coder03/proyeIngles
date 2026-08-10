// ==========================================================================
// firebase-messaging-sw.js — Service Worker
// CTP Santa Lucía · Alert System
// ==========================================================================
// This file MUST live at the root of the site (next to index.html), not
// inside a subfolder, so that its scope covers the entire domain. It uses
// the "compat" version of Firebase because Service Workers don't support
// ES module imports as easily as app.js does.

importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js"
);

// --------------------------------------------------------------------------
// ⚠️ REPLACE with the SAME configuration you used in app.js.
// (It can't be imported from app.js because the Service Worker runs in an
// isolated context, so it has to be repeated here).
// --------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyD59kWIwRAs6i8awCvDhByQPNzfbi57tb0",
  authDomain: "alert-545db.firebaseapp.com",
  projectId: "alert-545db",
  storageBucket: "alert-545db.firebasestorage.app",
  messagingSenderId: "143271858197",
  appId: "1:143271858197:web:e702305464ca74f237be1c",
  measurementId: "G-S4V6BP97ZM"
};

const messaging = firebase.messaging();

// Handles notifications that arrive when the tab is NOT in the foreground
// (tab closed, minimized, or in another window).
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Background message:", payload);

  const title = payload.notification?.title || "CTP Santa Lucía";
  const options = {
    body: payload.notification?.body || "",
    icon: "/icon.png", // optional: place an icon at /public/icon.png
    badge: "/icon.png",
    data: payload.data || {},
  };

  self.registration.showNotification(title, options);
});

// Optional: when the notification is clicked, focus/open the site's tab
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const hadWindowToFocus = clientsArr.some((windowClient) =>
        windowClient.url === self.location.origin + "/" ? (windowClient.focus(), true) : false
      );
      if (!hadWindowToFocus) {
        clients.openWindow("/");
      }
    })
  );
});
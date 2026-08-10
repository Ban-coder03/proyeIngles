// ==========================================================================
// app.js — Client-side logic (Firebase Cloud Messaging)
// CTP Santa Lucía · Alert System
// ==========================================================================
// This file uses Firebase v10+ ES modules via CDN (free, no build step).

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getMessaging,
  getToken,
  onMessage,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --------------------------------------------------------------------------
// 1) FIREBASE CONFIGURATION
// --------------------------------------------------------------------------
// ⚠️ REPLACE these values with the ones from YOUR Firebase project.
// Found in: Firebase Console > Project settings >
// "Your apps" > web icon (</>) > "Config".
// These values are NOT secret (they're public by Firebase's design),
// but they must exactly match your project.
const firebaseConfig = {
  apiKey: "AIzaSyD59kWIwRAs6i8awCvDhByQPNzfbi57tb0",
  authDomain: "alert-545db.firebaseapp.com",
  projectId: "alert-545db",
  storageBucket: "alert-545db.firebasestorage.app",
  messagingSenderId: "143271858197",
  appId: "1:143271858197:web:e702305464ca74f237be1c",
  measurementId: "G-S4V6BP97ZM"
};


// ⚠️ REPLACE with your public VAPID key.
// Generated in: Firebase Console > Project settings > Cloud Messaging
// > "Web Push certificates" > "Generate key pair".
const VAPID_KEY = "BBgtxcxTjhbBwE_uFr3WhAJAvSBBmbOEhG-IDOpBEiwCq57MlADMCkSSVVlknqcfq2GqBWMny5BCa6RS-dUeuWM";

// --------------------------------------------------------------------------
// 2) INITIALIZATION
// --------------------------------------------------------------------------
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
let messaging;

try {
  messaging = getMessaging(app);
} catch (err) {
  console.warn("FCM is not supported in this browser:", err);
}

// --------------------------------------------------------------------------
// 3) UI helpers
// --------------------------------------------------------------------------
const subscribeBtn = document.getElementById("btn-subscribe");
const subscribeStatus = document.getElementById("subscribe-status");
const sendStatus = document.getElementById("send-status");
const alertButtons = document.querySelectorAll(".alert-btn");

function showToast(title, body) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className =
    "toast bg-white text-slate-800 rounded-lg shadow-xl px-4 py-3 max-w-xs";
  toast.innerHTML = `<p class="font-bold text-sm">${title}</p><p class="text-xs mt-1">${body}</p>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}

// --------------------------------------------------------------------------
// 4) SUBSCRIPTION: request permission, get the FCM token, save it in Firestore
// --------------------------------------------------------------------------
async function subscribeToNotifications() {
  if (!("Notification" in window) || !messaging) {
    subscribeStatus.textContent =
      "This browser does not support push notifications.";
    return;
  }

  subscribeBtn.disabled = true;
  subscribeStatus.textContent = "Requesting permission...";

  try {
    // Register the Service Worker that handles background notifications
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      subscribeStatus.textContent =
        "Permission denied. Enable it from your browser settings.";
      subscribeBtn.disabled = false;
      return;
    }

    // Get this device/browser's unique FCM token
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      subscribeStatus.textContent =
        "Could not get the token. Please try again.";
      subscribeBtn.disabled = false;
      return;
    }

    // Save the token in Firestore (collection "tokens", doc id = the token itself)
    await setDoc(doc(db, "tokens", token), {
      token,
      userAgent: navigator.userAgent,
      createdAt: serverTimestamp(),
    });

    subscribeStatus.textContent = "✅ Subscription enabled successfully!";
    subscribeBtn.textContent = "🔔 Notifications enabled";
  } catch (err) {
    console.error("Error subscribing:", err);
    subscribeStatus.textContent = "Error enabling notifications.";
    subscribeBtn.disabled = false;
  }
}

subscribeBtn.addEventListener("click", subscribeToNotifications);

// --------------------------------------------------------------------------
// 5) FOREGROUND NOTIFICATIONS (tab open)
// --------------------------------------------------------------------------
if (messaging) {
  onMessage(messaging, (payload) => {
    console.log("Message received in foreground:", payload);
    const title = payload.notification?.title || "New alert";
    const body = payload.notification?.body || "";
    showToast(title, body);

    // Optional: also show a native browser notification
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icon.png" });
    }
  });
}

// --------------------------------------------------------------------------
// 6) SENDING ALERTS: calls the Vercel serverless function
// --------------------------------------------------------------------------
const ALERTS = {
  earthquake: { title: "🌍 Earthquake Alert", body: "The earthquake protocol has been activated. Head to the designated safe zone." },
  fire: { title: "🔥 Fire Alert", body: "The fire protocol has been activated. Evacuate calmly." },
  shooting: { title: "🚨 Shooting Alert", body: "The emergency protocol has been activated. Seek shelter immediately." },
};

alertButtons.forEach((btn) => {
  btn.addEventListener("click", async () => {
    const type = btn.dataset.alert;
    const alert = ALERTS[type];
    if (!alert) return;

    const confirmed = confirm(
      `Confirm sending "${alert.title}" to all subscribers?`
    );
    if (!confirmed) return;

    alertButtons.forEach((b) => (b.disabled = true));
    sendStatus.textContent = "Sending alert...";

    try {
      const res = await fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: alert.title,
          body: alert.body,
          type,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        sendStatus.textContent = `✅ Alert sent to ${data.successCount ?? "?"} device(s).`;
      } else {
        sendStatus.textContent = `❌ Error: ${data.error || "Could not send the alert."}`;
      }
    } catch (err) {
      console.error("Error sending alert:", err);
      sendStatus.textContent = "❌ Connection error while sending the alert.";
    } finally {
      alertButtons.forEach((b) => (b.disabled = false));
    }
  });
});